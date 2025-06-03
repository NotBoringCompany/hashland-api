import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Notification } from '../schemas/notification.schema';
import { NotificationPreference } from '../schemas/notification-preference.schema';
import {
  CreateNotificationDto,
  CreateBulkNotificationDto,
} from '../dto/create-notification.dto';
import {
  NotificationFilterDto,
  MarkNotificationsReadDto,
  UnreadCountDto,
} from '../dto/notification-filter.dto';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  NotificationDelivery,
} from '../types/notification.types';

/**
 * Interface for paginated notification results
 */
export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Interface for unread count results
 */
export interface UnreadCountResult {
  total: number;
  byType?: Record<NotificationType, number>;
  byPriority?: Record<NotificationPriority, number>;
}

/**
 * Service for managing notifications
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreference>,
  ) {}

  /**
   * Create a new notification
   */
  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(
        createNotificationDto.recipientId,
      );

      if (!this.shouldSendNotification(createNotificationDto, preferences)) {
        this.logger.warn(
          `Notification blocked by user preferences: ${createNotificationDto.recipientId}`,
        );
        throw new BadRequestException(
          'Notification blocked by user preferences',
        );
      }

      // Set default channels if not provided
      const channels = createNotificationDto.channels || [
        NotificationChannel.IN_APP,
        NotificationChannel.WEBSOCKET,
      ];

      // Initialize delivery tracking
      const delivery: NotificationDelivery[] = channels.map((channel) => ({
        channel,
        status: NotificationStatus.PENDING,
        retryCount: 0,
      }));

      const notification = new this.notificationModel({
        ...createNotificationDto,
        delivery,
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          clickThroughRate: 0,
          conversionRate: 0,
          engagementScore: 0,
        },
      });

      const savedNotification = await notification.save();
      this.logger.log(`Notification created: ${savedNotification._id}`);

      return savedNotification.populate(['recipient', 'sender']);
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create bulk notifications
   */
  async createBulk(createBulkDto: CreateBulkNotificationDto): Promise<{
    created: number;
    failed: number;
    notifications: Notification[];
  }> {
    try {
      const recipients = await this.resolveTargetRecipients(
        createBulkDto.target,
      );

      if (
        createBulkDto.maxRecipients &&
        recipients.length > createBulkDto.maxRecipients
      ) {
        recipients.splice(createBulkDto.maxRecipients);
      }

      const notifications: Notification[] = [];
      let created = 0;
      let failed = 0;

      for (const recipientId of recipients) {
        try {
          const notificationDto: CreateNotificationDto = {
            type: createBulkDto.type,
            priority: createBulkDto.priority,
            recipientId,
            senderId: createBulkDto.senderId,
            content: createBulkDto.content,
            channels: createBulkDto.channels,
            expiresAt: createBulkDto.expiresAt,
            schedule: createBulkDto.schedule,
            metadata: createBulkDto.metadata,
          };

          const notification = await this.create(notificationDto);
          notifications.push(notification);
          created++;
        } catch (error) {
          this.logger.warn(
            `Failed to create notification for user ${recipientId}: ${error.message}`,
          );
          failed++;
        }
      }

      this.logger.log(
        `Bulk notification created: ${created} successful, ${failed} failed`,
      );
      return { created, failed, notifications };
    } catch (error) {
      this.logger.error(
        `Failed to create bulk notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find notifications with filtering and pagination
   */
  async findAll(
    userId: Types.ObjectId,
    filterDto: NotificationFilterDto,
  ): Promise<PaginatedNotifications> {
    try {
      const query = this.buildFilterQuery(userId, filterDto);
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filterDto;

      const skip = (page - 1) * limit;
      const sort: { [key: string]: 1 | -1 } = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1,
      };

      // Build populate options
      const populateOptions = ['recipient'];
      if (filterDto.includeDelivery) {
        // Delivery is already included in the schema
      }

      const [notifications, total] = await Promise.all([
        this.notificationModel
          .find(query)
          .populate(populateOptions)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.notificationModel.countDocuments(query).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        notifications,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      this.logger.error(
        `Failed to find notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find a single notification by ID
   */
  async findOne(
    id: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<Notification> {
    try {
      const notification = await this.notificationModel
        .findOne({ _id: id, recipientId: userId })
        .populate(['recipient', 'sender'])
        .exec();

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Track impression
      await this.trackImpression(id);

      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to find notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(
    userId: Types.ObjectId,
    markReadDto: MarkNotificationsReadDto,
  ): Promise<{ modifiedCount: number; notifications: Notification[] }> {
    try {
      let query: FilterQuery<Notification>;

      if (markReadDto.markAll) {
        query = { recipientId: userId, isRead: false };

        if (markReadDto.types?.length) {
          query.type = { $in: markReadDto.types };
        }

        if (markReadDto.createdBefore) {
          query.createdAt = { $lt: markReadDto.createdBefore };
        }
      } else if (markReadDto.notificationIds?.length) {
        query = {
          _id: { $in: markReadDto.notificationIds },
          recipientId: userId,
          isRead: false,
        };
      } else {
        throw new BadRequestException(
          'Either notificationIds or markAll must be provided',
        );
      }

      const updateResult = await this.notificationModel.updateMany(query, {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Get updated notifications
      const notifications = await this.notificationModel
        .find({ ...query, isRead: true })
        .populate(['recipient', 'sender'])
        .exec();

      this.logger.log(
        `Marked ${updateResult.modifiedCount} notifications as read for user ${userId}`,
      );

      return {
        modifiedCount: updateResult.modifiedCount,
        notifications,
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark notifications as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async delete(id: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    try {
      const result = await this.notificationModel.deleteOne({
        _id: id,
        recipientId: userId,
      });

      if (result.deletedCount === 0) {
        throw new NotFoundException('Notification not found');
      }

      this.logger.log(`Notification deleted: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(
    userId: Types.ObjectId,
    countDto: UnreadCountDto,
  ): Promise<UnreadCountResult> {
    try {
      const query: FilterQuery<Notification> = {
        recipientId: userId,
        isRead: false,
      };

      if (countDto.types?.length) {
        query.type = { $in: countDto.types };
      }

      if (countDto.minPriority) {
        const priorityOrder = [
          NotificationPriority.LOW,
          NotificationPriority.MEDIUM,
          NotificationPriority.HIGH,
          NotificationPriority.CRITICAL,
        ];
        const minIndex = priorityOrder.indexOf(countDto.minPriority);
        query.priority = { $in: priorityOrder.slice(minIndex) };
      }

      const total = await this.notificationModel.countDocuments(query);

      const result: UnreadCountResult = { total };

      if (countDto.groupByType) {
        const typeAggregation = await this.notificationModel.aggregate([
          { $match: query },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]);

        result.byType = typeAggregation.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {});
      }

      if (countDto.groupByPriority) {
        const priorityAggregation = await this.notificationModel.aggregate([
          { $match: query },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]);

        result.byPriority = priorityAggregation.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {});
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    notificationId: Types.ObjectId,
    channel: NotificationChannel,
    status: NotificationStatus,
    failureReason?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        'delivery.$.status': status,
      };

      switch (status) {
        case NotificationStatus.SENT:
          updateData['delivery.$.sentAt'] = new Date();
          break;
        case NotificationStatus.DELIVERED:
          updateData['delivery.$.deliveredAt'] = new Date();
          break;
        case NotificationStatus.FAILED:
          updateData['delivery.$.failureReason'] = failureReason;
          updateData['$inc'] = { 'delivery.$.retryCount': 1 };
          break;
      }

      await this.notificationModel.updateOne(
        { _id: notificationId, 'delivery.channel': channel },
        updateData,
      );

      this.logger.debug(
        `Updated delivery status for notification ${notificationId}, channel ${channel}: ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update delivery status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Track notification impression
   */
  private async trackImpression(notificationId: Types.ObjectId): Promise<void> {
    await this.notificationModel.updateOne(
      { _id: notificationId },
      { $inc: { 'analytics.impressions': 1 } },
    );
  }

  /**
   * Build filter query from DTO
   */
  private buildFilterQuery(
    userId: Types.ObjectId,
    filterDto: NotificationFilterDto,
  ): FilterQuery<Notification> {
    const query: FilterQuery<Notification> = { recipientId: userId };

    if (filterDto.type) {
      query.type = filterDto.type;
    }

    if (filterDto.types?.length) {
      query.type = { $in: filterDto.types };
    }

    if (filterDto.priority) {
      query.priority = filterDto.priority;
    }

    if (filterDto.priorities?.length) {
      query.priority = { $in: filterDto.priorities };
    }

    if (typeof filterDto.isRead === 'boolean') {
      query.isRead = filterDto.isRead;
    }

    if (filterDto.senderId) {
      query.senderId = filterDto.senderId;
    }

    if (filterDto.relatedEntityId) {
      query.relatedEntityId = filterDto.relatedEntityId;
    }

    if (filterDto.relatedEntityType) {
      query.relatedEntityType = filterDto.relatedEntityType;
    }

    if (filterDto.channel) {
      query['delivery.channel'] = filterDto.channel;
    }

    if (filterDto.deliveryStatus) {
      query['delivery.status'] = filterDto.deliveryStatus;
    }

    if (filterDto.createdAfter || filterDto.createdBefore) {
      query.createdAt = {};
      if (filterDto.createdAfter) {
        query.createdAt.$gte = filterDto.createdAfter;
      }
      if (filterDto.createdBefore) {
        query.createdAt.$lte = filterDto.createdBefore;
      }
    }

    if (filterDto.expiresAfter || filterDto.expiresBefore) {
      query.expiresAt = {};
      if (filterDto.expiresAfter) {
        query.expiresAt.$gte = filterDto.expiresAfter;
      }
      if (filterDto.expiresBefore) {
        query.expiresAt.$lte = filterDto.expiresBefore;
      }
    }

    if (filterDto.search) {
      query.$or = [
        { 'content.data.title': { $regex: filterDto.search, $options: 'i' } },
        { 'content.data.message': { $regex: filterDto.search, $options: 'i' } },
      ];
    }

    if (filterDto.metadata) {
      const [key, value] = filterDto.metadata.split(':');
      if (key && value) {
        query[`metadata.${key}`] = value;
      }
    }

    return query;
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(
    userId: Types.ObjectId,
  ): Promise<NotificationPreference | null> {
    return this.preferenceModel.findOne({ userId }).exec();
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(
    notificationDto: CreateNotificationDto,
    preferences: NotificationPreference | null,
  ): boolean {
    if (!preferences || !preferences.globalSettings.enabled) {
      return false;
    }

    const typePreference = preferences.typePreferences.find(
      (pref) => pref.type === notificationDto.type,
    );

    if (typePreference && !typePreference.enabled) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours.enabled) {
      const now = new Date();
      // Simplified quiet hours check (would need proper timezone handling)
      const currentHour = now.getUTCHours();
      const startHour = parseInt(
        preferences.quietHours.startTime.split(':')[0],
      );
      const endHour = parseInt(preferences.quietHours.endTime.split(':')[0]);

      if (
        (startHour <= endHour &&
          currentHour >= startHour &&
          currentHour < endHour) ||
        (startHour > endHour &&
          (currentHour >= startHour || currentHour < endHour))
      ) {
        // Check if this is a critical notification that overrides quiet hours
        if (
          notificationDto.priority !== NotificationPriority.CRITICAL ||
          !preferences.quietHours.overrideForCritical
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Resolve target recipients from targeting criteria
   */
  private async resolveTargetRecipients(
    target: any,
  ): Promise<Types.ObjectId[]> {
    // This would integrate with the Operator service to resolve recipients
    // For now, return userIds if provided
    if (target.userIds?.length) {
      return target.userIds;
    }

    // TODO: Implement criteria-based recipient resolution
    // This would query the Operator collection based on roles, level, etc.
    return [];
  }
}
