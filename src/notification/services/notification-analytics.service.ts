import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from '../schemas/notification.schema';
import { NotificationChannel } from '../types/notification.types';

/**
 * Service for tracking notification analytics and engagement metrics
 */
@Injectable()
export class NotificationAnalyticsService {
  private readonly logger = new Logger(NotificationAnalyticsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  /**
   * Track notification impression
   */
  async trackImpression(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      await this.notificationModel.updateOne(
        { _id: notificationId, recipientId: userId },
        { $inc: { 'analytics.impressions': 1 } },
      );

      this.logger.debug(
        `Tracked impression for notification ${notificationId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track impression: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Track notification click
   */
  async trackClick(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      const updateQuery: any = { $inc: { 'analytics.clicks': 1 } };

      // Update click-through rate
      const notification =
        await this.notificationModel.findById(notificationId);
      if (notification) {
        const newClicks = notification.analytics.clicks + 1;
        const impressions = notification.analytics.impressions || 1;
        updateQuery['analytics.clickThroughRate'] =
          (newClicks / impressions) * 100;
      }

      await this.notificationModel.updateOne(
        { _id: notificationId, recipientId: userId },
        updateQuery,
      );

      this.logger.debug(
        `Tracked click for notification ${notificationId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`, error.stack);
    }
  }

  /**
   * Track notification conversion
   */
  async trackConversion(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      const updateQuery: any = { $inc: { 'analytics.conversions': 1 } };

      // Update conversion rate
      const notification =
        await this.notificationModel.findById(notificationId);
      if (notification) {
        const newConversions = notification.analytics.conversions + 1;
        const impressions = notification.analytics.impressions || 1;
        updateQuery['analytics.conversionRate'] =
          (newConversions / impressions) * 100;

        // Update engagement score (simple formula)
        const clicks = notification.analytics.clicks || 0;
        const engagementScore =
          ((clicks + newConversions * 2) / impressions) * 100;
        updateQuery['analytics.engagementScore'] = Math.min(
          engagementScore,
          100,
        );
      }

      await this.notificationModel.updateOne(
        { _id: notificationId, recipientId: userId },
        updateQuery,
      );

      this.logger.debug(
        `Tracked conversion for notification ${notificationId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track conversion: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Track notification delivery
   */
  async trackDelivery(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
    channel: NotificationChannel,
    deliveryTime: number,
  ): Promise<void> {
    try {
      // This could be expanded to track delivery metrics per channel
      this.logger.debug(
        `Tracked delivery for notification ${notificationId} via ${channel} in ${deliveryTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track delivery: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Track notification read event
   */
  async trackRead(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Update engagement score when notification is read
      const notification =
        await this.notificationModel.findById(notificationId);
      if (notification) {
        const impressions = notification.analytics.impressions || 1;
        const clicks = notification.analytics.clicks || 0;
        const conversions = notification.analytics.conversions || 0;

        // Reading counts as basic engagement
        const engagementScore =
          ((1 + clicks + conversions * 2) / impressions) * 100;

        await this.notificationModel.updateOne(
          { _id: notificationId },
          { 'analytics.engagementScore': Math.min(engagementScore, 100) },
        );
      }

      this.logger.debug(
        `Tracked read for notification ${notificationId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to track read: ${error.message}`, error.stack);
    }
  }

  /**
   * Get analytics summary for notifications
   */
  async getAnalyticsSummary(
    filters: {
      userId?: Types.ObjectId;
      notificationType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<{
    totalNotifications: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageClickThroughRate: number;
    averageConversionRate: number;
    averageEngagementScore: number;
  }> {
    try {
      const matchStage: any = {};

      if (filters.userId) {
        matchStage.recipientId = filters.userId;
      }

      if (filters.notificationType) {
        matchStage.type = filters.notificationType;
      }

      if (filters.dateFrom || filters.dateTo) {
        matchStage.createdAt = {};
        if (filters.dateFrom) {
          matchStage.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          matchStage.createdAt.$lte = filters.dateTo;
        }
      }

      const result = await this.notificationModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            totalImpressions: { $sum: '$analytics.impressions' },
            totalClicks: { $sum: '$analytics.clicks' },
            totalConversions: { $sum: '$analytics.conversions' },
            avgClickThroughRate: { $avg: '$analytics.clickThroughRate' },
            avgConversionRate: { $avg: '$analytics.conversionRate' },
            avgEngagementScore: { $avg: '$analytics.engagementScore' },
          },
        },
      ]);

      const summary = result[0] || {
        totalNotifications: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        avgClickThroughRate: 0,
        avgConversionRate: 0,
        avgEngagementScore: 0,
      };

      return {
        totalNotifications: summary.totalNotifications,
        totalImpressions: summary.totalImpressions,
        totalClicks: summary.totalClicks,
        totalConversions: summary.totalConversions,
        averageClickThroughRate: summary.avgClickThroughRate || 0,
        averageConversionRate: summary.avgConversionRate || 0,
        averageEngagementScore: summary.avgEngagementScore || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
