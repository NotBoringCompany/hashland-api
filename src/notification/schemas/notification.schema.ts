import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Operator } from 'src/operators/schemas/operator.schema';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationContent,
  NotificationDelivery,
  NotificationSchedule,
  NotificationAnalytics,
  NotificationChannel,
  NotificationContentType,
} from '../types/notification.types';

/**
 * Schema for notifications in the notification system
 */
@Schema({
  timestamps: true,
  collection: 'Notifications',
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Notification extends Document {
  /**
   * The database ID of the notification
   */
  @ApiProperty({
    description: 'The database ID of the notification',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The type of notification
   */
  @ApiProperty({
    description: 'The type of notification',
    example: 'auction_bid',
    enum: NotificationType,
  })
  @Prop({
    type: String,
    enum: NotificationType,
    required: true,
    index: true,
  })
  type: NotificationType;

  /**
   * The priority level of the notification
   */
  @ApiProperty({
    description: 'The priority level of the notification',
    example: 'high',
    enum: NotificationPriority,
  })
  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
    index: true,
  })
  priority: NotificationPriority;

  /**
   * The recipient of the notification
   */
  @ApiProperty({
    description: 'The recipient of the notification',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: Operator.name,
    required: true,
    index: true,
  })
  recipientId: Types.ObjectId;

  /**
   * The recipient operator
   */
  @ApiProperty({
    description: 'The recipient operator',
  })
  recipient: Operator;

  /**
   * The sender of the notification (optional, system notifications have no sender)
   */
  @ApiProperty({
    description: 'The sender of the notification',
    example: '507f1f77bcf86cd799439013',
    required: false,
  })
  @Prop({
    type: Types.ObjectId,
    ref: Operator.name,
    required: false,
    index: true,
  })
  senderId?: Types.ObjectId;

  /**
   * The sender operator
   */
  @ApiProperty({
    description: 'The sender operator',
    required: false,
  })
  sender?: Operator;

  /**
   * The dynamic content of the notification
   */
  @ApiProperty({
    description: 'The dynamic content of the notification',
    example: {
      type: 'text',
      data: {
        title: 'New Bid Placed',
        message: 'Your bid has been outbid in the auction',
        metadata: { auctionId: '507f1f77bcf86cd799439014', bidAmount: 250 },
      },
    },
  })
  @Prop({
    type: {
      type: {
        type: String,
        enum: NotificationContentType,
        required: true,
      },
      data: {
        title: { type: String, required: true },
        message: { type: String, required: true },
        metadata: { type: Map, of: String, default: {} },
        actions: [
          {
            id: { type: String, required: true },
            label: { type: String, required: true },
            type: {
              type: String,
              enum: ['button', 'link', 'dismiss'],
              required: true,
            },
            url: { type: String, required: false },
            action: { type: String, required: false },
            style: {
              type: String,
              enum: ['primary', 'secondary', 'danger', 'success'],
              required: false,
            },
          },
        ],
        template: {
          templateId: { type: String, required: false },
          variables: { type: Map, of: String, default: {} },
        },
        imageUrl: { type: String, required: false },
        iconUrl: { type: String, required: false },
      },
    },
    required: true,
  })
  content: NotificationContent;

  /**
   * The delivery status and tracking information
   */
  @ApiProperty({
    description: 'The delivery status and tracking information',
    example: [
      {
        channel: 'websocket',
        status: 'delivered',
        sentAt: '2024-03-19T12:00:00.000Z',
        deliveredAt: '2024-03-19T12:00:01.000Z',
        retryCount: 0,
      },
    ],
  })
  @Prop({
    type: [
      {
        channel: {
          type: String,
          enum: NotificationChannel,
          required: true,
        },
        status: {
          type: String,
          enum: NotificationStatus,
          default: NotificationStatus.PENDING,
        },
        sentAt: { type: Date, required: false },
        deliveredAt: { type: Date, required: false },
        readAt: { type: Date, required: false },
        failureReason: { type: String, required: false },
        retryCount: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  delivery: NotificationDelivery[];

  /**
   * Whether the notification has been read
   */
  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isRead: boolean;

  /**
   * When the notification was read
   */
  @ApiProperty({
    description: 'When the notification was read',
    example: '2024-03-19T12:30:00.000Z',
    required: false,
  })
  @Prop({
    type: Date,
    required: false,
  })
  readAt?: Date;

  /**
   * When the notification expires
   */
  @ApiProperty({
    description: 'When the notification expires',
    example: '2024-04-19T12:00:00.000Z',
    required: false,
  })
  @Prop({
    type: Date,
    required: false,
    index: true,
  })
  expiresAt?: Date;

  /**
   * Reference to related entity (auction, transaction, etc.)
   */
  @ApiProperty({
    description: 'Reference to related entity',
    example: '507f1f77bcf86cd799439014',
    required: false,
  })
  @Prop({
    type: Types.ObjectId,
    required: false,
    index: true,
  })
  relatedEntityId?: Types.ObjectId;

  /**
   * Type of the related entity
   */
  @ApiProperty({
    description: 'Type of the related entity',
    example: 'auction',
    required: false,
  })
  @Prop({
    type: String,
    required: false,
  })
  relatedEntityType?: string;

  /**
   * Scheduling information for the notification
   */
  @ApiProperty({
    description: 'Scheduling information for the notification',
    example: {
      scheduledFor: '2024-03-19T15:00:00.000Z',
      timezone: 'UTC',
    },
    required: false,
  })
  @Prop({
    type: {
      scheduledFor: { type: Date, required: false },
      timezone: { type: String, default: 'UTC' },
      recurring: {
        pattern: {
          type: String,
          enum: ['daily', 'weekly', 'monthly'],
          required: false,
        },
        interval: { type: Number, required: false },
        endDate: { type: Date, required: false },
      },
    },
    required: false,
  })
  schedule?: NotificationSchedule;

  /**
   * Analytics data for the notification
   */
  @ApiProperty({
    description: 'Analytics data for the notification',
    example: {
      impressions: 1,
      clicks: 0,
      conversions: 0,
      clickThroughRate: 0,
      conversionRate: 0,
      engagementScore: 0.5,
    },
  })
  @Prop({
    type: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      clickThroughRate: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
    },
    default: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      clickThroughRate: 0,
      conversionRate: 0,
      engagementScore: 0,
    },
  })
  analytics: NotificationAnalytics;

  /**
   * Additional metadata for the notification
   */
  @ApiProperty({
    description: 'Additional metadata for the notification',
    example: { source: 'auction_system', version: '1.0' },
    required: false,
  })
  @Prop({
    type: Map,
    of: String,
    default: {},
  })
  metadata: Record<string, any>;

  /**
   * The timestamp when the notification was created
   */
  @ApiProperty({
    description: 'The timestamp when the notification was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the notification was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the notification was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for Notification
 */
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Create indexes for better query performance
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ priority: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
NotificationSchema.index({ senderId: 1 });
NotificationSchema.index({ 'delivery.status': 1 });
NotificationSchema.index({ 'schedule.scheduledFor': 1 });

// Virtual for recipient
NotificationSchema.virtual('recipient', {
  ref: Operator.name,
  localField: 'recipientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for sender
NotificationSchema.virtual('sender', {
  ref: Operator.name,
  localField: 'senderId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to set expiration
NotificationSchema.pre('save', function (next) {
  if (!this.expiresAt && this.type) {
    // Set default expiration based on notification type
    const defaultRetentionDays = {
      [NotificationType.SYSTEM_ALERT]: 30,
      [NotificationType.MAINTENANCE]: 7,
      [NotificationType.UPDATE]: 30,
      [NotificationType.SECURITY]: 90,
      [NotificationType.AUCTION_BID]: 90,
      [NotificationType.AUCTION_WHITELIST]: 30,
      [NotificationType.TRANSACTION]: 365,
      [NotificationType.ACHIEVEMENT]: 365,
      [NotificationType.REFERRAL]: 90,
      [NotificationType.CUSTOM]: 30,
      [NotificationType.PROMOTIONAL]: 7,
      [NotificationType.SOCIAL]: 30,
    };

    const retentionDays = defaultRetentionDays[this.type] || 30;
    this.expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }
  next();
});
