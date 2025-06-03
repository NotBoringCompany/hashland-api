import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationService } from '../services/notification.service';
import { NotificationTemplateEngineService } from '../services/notification-template-engine.service';
import { NotificationAnalyticsService } from '../services/notification-analytics.service';
import { NotificationTemplateService } from '../services/notification-template.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import {
  NotificationPriority,
  NotificationChannel,
  NotificationContentType,
} from '../types/notification.types';
import { Types } from 'mongoose';

/**
 * Job data for single notification processing
 */
export interface NotificationJobData {
  notification: CreateNotificationDto;
  userId: Types.ObjectId;
  templateId?: string;
  templateContext?: any;
  priority: NotificationPriority;
  maxRetries?: number;
  delayMs?: number;
}

/**
 * Job data for batch notification processing
 */
export interface BatchNotificationJobData {
  notifications: Array<{
    notification: CreateNotificationDto;
    userId: Types.ObjectId;
    templateId?: string;
    templateContext?: any;
  }>;
  priority: NotificationPriority;
  batchId: string;
  maxRetries?: number;
}

/**
 * Job data for broadcast notification processing
 */
export interface BroadcastNotificationJobData {
  notification: CreateNotificationDto;
  userIds: Types.ObjectId[];
  templateId?: string;
  templateContext?: any;
  priority: NotificationPriority;
  broadcastId: string;
  batchSize?: number;
  maxRetries?: number;
}

/**
 * Processor for notification queue operations
 */
@Processor('notification')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly templateEngineService: NotificationTemplateEngineService,
    private readonly analyticsService: NotificationAnalyticsService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  /**
   * Process single notification
   */
  @Process('send-notification')
  async processSendNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notification, userId, templateId, templateContext, priority } =
      job.data;
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Processing notification job ${job.id} for user ${userId}`,
      );

      // Create notification content from template if provided
      let finalNotification = { ...notification };
      if (templateId && templateContext) {
        const renderedContent = await this.templateEngineService.renderTemplate(
          new Types.ObjectId(templateId),
          templateContext,
        );

        finalNotification = {
          ...notification,
          content: {
            type: NotificationContentType.TEMPLATE,
            data: {
              title: renderedContent.title,
              message: renderedContent.message,
              metadata: renderedContent.metadata,
              actions: renderedContent.actions,
            },
          },
        };

        // Update template usage stats
        await this.templateService.updateUsageStats(
          new Types.ObjectId(templateId),
          Date.now() - startTime,
          true,
        );
      }

      // Create notification in database with proper DTO structure
      const createDto: CreateNotificationDto = {
        ...finalNotification,
        recipientId: userId,
        priority,
      };

      const createdNotification =
        await this.notificationService.create(createDto);

      // Track delivery time and analytics
      const deliveryTime = Date.now() - startTime;

      // Track analytics (WebSocket delivery will be handled by the gateway separately)
      await this.analyticsService.trackDelivery(
        createdNotification._id,
        userId,
        NotificationChannel.IN_APP,
        deliveryTime,
      );

      this.logger.log(
        `Notification ${createdNotification._id} processed successfully for user ${userId} (${deliveryTime}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notification job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error; // Bull will handle retries
    }
  }

  /**
   * Process batch notifications
   */
  @Process('send-batch-notifications')
  async processBatchNotifications(
    job: Job<BatchNotificationJobData>,
  ): Promise<void> {
    const { notifications, priority, batchId } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Processing batch ${batchId} with ${notifications.length} notifications`,
    );

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const notificationData of notifications) {
      try {
        const { notification, userId, templateId, templateContext } =
          notificationData;

        // Create notification content from template if provided
        let finalNotification = { ...notification };
        if (templateId && templateContext) {
          const renderedContent =
            await this.templateEngineService.renderTemplate(
              new Types.ObjectId(templateId),
              templateContext,
            );

          finalNotification = {
            ...notification,
            content: {
              type: NotificationContentType.TEMPLATE,
              data: {
                title: renderedContent.title,
                message: renderedContent.message,
                metadata: renderedContent.metadata,
                actions: renderedContent.actions,
              },
            },
          };
        }

        // Create notification in database with proper DTO structure
        const createDto: CreateNotificationDto = {
          ...finalNotification,
          recipientId: userId,
          priority,
          metadata: {
            ...finalNotification.metadata,
            batchId,
          },
        };

        const createdNotification =
          await this.notificationService.create(createDto);

        // Track analytics
        await this.analyticsService.trackDelivery(
          createdNotification._id,
          userId,
          NotificationChannel.IN_APP,
          Date.now() - startTime,
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
        this.logger.error(
          `Failed to process notification in batch ${batchId}: ${error.message}`,
        );
      }
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Batch ${batchId} completed: ${results.success} success, ${results.failed} failed (${processingTime}ms)`,
    );

    if (results.failed > 0) {
      throw new Error(
        `Batch processing failed for ${results.failed}/${notifications.length} notifications: ${results.errors.join(', ')}`,
      );
    }
  }

  /**
   * Process broadcast notifications
   */
  @Process('send-broadcast-notification')
  async processBroadcastNotification(
    job: Job<BroadcastNotificationJobData>,
  ): Promise<void> {
    const {
      notification,
      userIds,
      templateId,
      templateContext,
      priority,
      broadcastId,
      batchSize = 100,
    } = job.data;

    const startTime = Date.now();
    this.logger.log(
      `Processing broadcast ${broadcastId} to ${userIds.length} users`,
    );

    // Process users in batches to avoid overwhelming the system
    const batches = this.chunkArray(userIds, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchId = `${broadcastId}_batch_${i + 1}`;

      try {
        const batchNotifications = batch.map((userId) => ({
          notification,
          userId,
          templateId,
          templateContext,
        }));

        // Process this batch
        await this.processBatchNotifications({
          data: {
            notifications: batchNotifications,
            priority,
            batchId,
          },
        } as Job<BatchNotificationJobData>);

        this.logger.debug(
          `Broadcast batch ${i + 1}/${batches.length} completed`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process broadcast batch ${batchId}: ${error.message}`,
        );
        // Continue with other batches
      }
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Broadcast ${broadcastId} completed for ${userIds.length} users (${processingTime}ms)`,
    );
  }

  /**
   * Process delayed notifications
   */
  @Process('send-delayed-notification')
  async processDelayedNotification(
    job: Job<NotificationJobData>,
  ): Promise<void> {
    this.logger.debug(`Processing delayed notification job ${job.id}`);
    return this.processSendNotification(job);
  }

  /**
   * Handle job activation
   */
  @OnQueueActive()
  onActive(job: Job): void {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}...`);
  }

  /**
   * Handle job completion
   */
  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  /**
   * Handle job failure
   */
  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Utility method to chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
