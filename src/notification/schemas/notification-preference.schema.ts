import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Operator } from 'src/operators/schemas/operator.schema';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '../types/notification.types';

/**
 * Schema for individual notification type preferences
 */
export interface NotificationTypePreference {
  type: NotificationType;
  enabled: boolean;
  channels: NotificationChannel[];
  minPriority: NotificationPriority;
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

/**
 * Schema for channel-specific settings
 */
export interface ChannelSettings {
  channel: NotificationChannel;
  enabled: boolean;
  settings: Record<string, any>;
}

/**
 * Schema for notification preferences
 */
@Schema({
  timestamps: true,
  collection: 'NotificationPreferences',
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class NotificationPreference extends Document {
  /**
   * The database ID of the preference
   */
  @ApiProperty({
    description: 'The database ID of the preference',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The user these preferences belong to
   */
  @ApiProperty({
    description: 'The user these preferences belong to',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: Operator.name,
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  /**
   * The user operator
   */
  @ApiProperty({
    description: 'The user operator',
  })
  user: Operator;

  /**
   * Global notification settings
   */
  @ApiProperty({
    description: 'Global notification settings',
    example: {
      enabled: true,
      maxPerDay: 50,
      batchDelivery: false,
      markAsReadOnView: true,
    },
  })
  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      maxPerDay: { type: Number, default: 100 },
      batchDelivery: { type: Boolean, default: false },
      markAsReadOnView: { type: Boolean, default: true },
    },
    default: {
      enabled: true,
      maxPerDay: 100,
      batchDelivery: false,
      markAsReadOnView: true,
    },
  })
  globalSettings: {
    enabled: boolean;
    maxPerDay: number;
    batchDelivery: boolean;
    markAsReadOnView: boolean;
  };

  /**
   * Preferences for each notification type
   */
  @ApiProperty({
    description: 'Preferences for each notification type',
    example: [
      {
        type: 'auction_bid',
        enabled: true,
        channels: ['in_app', 'websocket'],
        minPriority: 'medium',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'UTC',
        },
      },
    ],
  })
  @Prop({
    type: [
      {
        type: {
          type: String,
          enum: NotificationType,
          required: true,
        },
        enabled: { type: Boolean, default: true },
        channels: {
          type: [String],
          enum: NotificationChannel,
          default: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
        },
        minPriority: {
          type: String,
          enum: NotificationPriority,
          default: NotificationPriority.LOW,
        },
        quietHours: {
          enabled: { type: Boolean, default: false },
          startTime: { type: String, default: '22:00' },
          endTime: { type: String, default: '08:00' },
          timezone: { type: String, default: 'UTC' },
        },
      },
    ],
    default: [],
  })
  typePreferences: NotificationTypePreference[];

  /**
   * Channel-specific settings
   */
  @ApiProperty({
    description: 'Channel-specific settings',
    example: [
      {
        channel: 'websocket',
        enabled: true,
        settings: {
          sound: true,
          vibration: false,
          showPreview: true,
        },
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
        enabled: { type: Boolean, default: true },
        settings: { type: Map, of: String, default: {} },
      },
    ],
    default: [],
  })
  channelSettings: ChannelSettings[];

  /**
   * Global quiet hours settings
   */
  @ApiProperty({
    description: 'Global quiet hours settings',
    example: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      overrideForCritical: true,
    },
  })
  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '22:00' },
      endTime: { type: String, default: '08:00' },
      timezone: { type: String, default: 'UTC' },
      overrideForCritical: { type: Boolean, default: true },
    },
    default: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      overrideForCritical: true,
    },
  })
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
    overrideForCritical: boolean;
  };

  /**
   * Block list for specific senders or entities
   */
  @ApiProperty({
    description: 'Block list for specific senders or entities',
    example: {
      users: ['507f1f77bcf86cd799439013'],
      entities: [
        {
          type: 'auction',
          id: '507f1f77bcf86cd799439014',
        },
      ],
    },
  })
  @Prop({
    type: {
      users: [{ type: Types.ObjectId, ref: Operator.name }],
      entities: [
        {
          type: { type: String, required: true },
          id: { type: Types.ObjectId, required: true },
        },
      ],
    },
    default: {
      users: [],
      entities: [],
    },
  })
  blockList: {
    users: Types.ObjectId[];
    entities: Array<{
      type: string;
      id: Types.ObjectId;
    }>;
  };

  /**
   * Digest delivery preferences
   */
  @ApiProperty({
    description: 'Digest delivery preferences',
    example: {
      enabled: false,
      frequency: 'daily',
      time: '09:00',
      timezone: 'UTC',
      includeTypes: ['auction_bid', 'transaction'],
    },
  })
  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly'],
        default: 'daily',
      },
      time: { type: String, default: '09:00' },
      timezone: { type: String, default: 'UTC' },
      includeTypes: {
        type: [String],
        enum: NotificationType,
        default: [],
      },
    },
    default: {
      enabled: false,
      frequency: 'daily',
      time: '09:00',
      timezone: 'UTC',
      includeTypes: [],
    },
  })
  digestSettings: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time: string;
    timezone: string;
    includeTypes: NotificationType[];
  };

  /**
   * Language and localization preferences
   */
  @ApiProperty({
    description: 'Language and localization preferences',
    example: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h',
    },
  })
  @Prop({
    type: {
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '24h',
      },
    },
    default: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h',
    },
  })
  localization: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };

  /**
   * Privacy settings
   */
  @ApiProperty({
    description: 'Privacy settings',
    example: {
      allowAnalytics: true,
      shareUsageData: false,
      showOnlineStatus: true,
    },
  })
  @Prop({
    type: {
      allowAnalytics: { type: Boolean, default: true },
      shareUsageData: { type: Boolean, default: false },
      showOnlineStatus: { type: Boolean, default: true },
    },
    default: {
      allowAnalytics: true,
      shareUsageData: false,
      showOnlineStatus: true,
    },
  })
  privacy: {
    allowAnalytics: boolean;
    shareUsageData: boolean;
    showOnlineStatus: boolean;
  };

  /**
   * Last time preferences were updated
   */
  @ApiProperty({
    description: 'Last time preferences were updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  @Prop({
    type: Date,
    default: Date.now,
  })
  lastModified: Date;

  /**
   * The timestamp when the preferences were created
   */
  @ApiProperty({
    description: 'The timestamp when the preferences were created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the preferences were last updated
   */
  @ApiProperty({
    description: 'The timestamp when the preferences were last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for NotificationPreference
 */
export const NotificationPreferenceSchema = SchemaFactory.createForClass(
  NotificationPreference,
);

// Create indexes for better query performance
NotificationPreferenceSchema.index({ userId: 1 }, { unique: true });
NotificationPreferenceSchema.index({ 'typePreferences.type': 1 });
NotificationPreferenceSchema.index({ 'channelSettings.channel': 1 });
NotificationPreferenceSchema.index({ 'globalSettings.enabled': 1 });
NotificationPreferenceSchema.index({ lastModified: -1 });

// Virtual for user
NotificationPreferenceSchema.virtual('user', {
  ref: Operator.name,
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to update lastModified
NotificationPreferenceSchema.pre('save', function (next) {
  this.lastModified = new Date();
  next();
});

// Static method to get default preferences for a user
NotificationPreferenceSchema.statics.getDefaultPreferences = function (
  userId: Types.ObjectId,
) {
  const defaultTypePreferences: NotificationTypePreference[] = Object.values(
    NotificationType,
  ).map((type) => ({
    type,
    enabled: true,
    channels: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
    minPriority: NotificationPriority.LOW,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
    },
  }));

  const defaultChannelSettings: ChannelSettings[] = Object.values(
    NotificationChannel,
  ).map((channel) => ({
    channel,
    enabled: true,
    settings: {},
  }));

  return {
    userId,
    globalSettings: {
      enabled: true,
      maxPerDay: 100,
      batchDelivery: false,
      markAsReadOnView: true,
    },
    typePreferences: defaultTypePreferences,
    channelSettings: defaultChannelSettings,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      overrideForCritical: true,
    },
    blockList: {
      users: [],
      entities: [],
    },
    digestSettings: {
      enabled: false,
      frequency: 'daily' as const,
      time: '09:00',
      timezone: 'UTC',
      includeTypes: [],
    },
    localization: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h' as const,
    },
    privacy: {
      allowAnalytics: true,
      shareUsageData: false,
      showOnlineStatus: true,
    },
  };
};
