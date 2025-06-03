import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
  NotificationContentType,
  NotificationChannel,
} from '../types/notification.types';

/**
 * Schema for template variables definition
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

/**
 * Schema for template rendering configuration
 */
export interface TemplateRenderConfig {
  engine: 'handlebars' | 'mustache' | 'plain';
  escapeHtml: boolean;
  allowedHelpers?: string[];
  partials?: Record<string, string>;
}

/**
 * Schema for notification templates
 */
@Schema({
  timestamps: true,
  collection: 'NotificationTemplates',
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class NotificationTemplate extends Document {
  /**
   * The database ID of the template
   */
  @ApiProperty({
    description: 'The database ID of the template',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * Unique identifier for the template
   */
  @ApiProperty({
    description: 'Unique identifier for the template',
    example: 'auction_bid_outbid',
  })
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  templateId: string;

  /**
   * Human-readable name of the template
   */
  @ApiProperty({
    description: 'Human-readable name of the template',
    example: 'Auction Bid Outbid Notification',
  })
  @Prop({
    type: String,
    required: true,
  })
  name: string;

  /**
   * Description of the template
   */
  @ApiProperty({
    description: 'Description of the template',
    example: 'Template for notifying users when their bid is outbid',
  })
  @Prop({
    type: String,
    required: true,
  })
  description: string;

  /**
   * The notification type this template is for
   */
  @ApiProperty({
    description: 'The notification type this template is for',
    example: 'auction_bid',
    enum: NotificationType,
  })
  @Prop({
    type: String,
    enum: NotificationType,
    required: true,
    index: true,
  })
  notificationType: NotificationType;

  /**
   * The content type of the template
   */
  @ApiProperty({
    description: 'The content type of the template',
    example: 'template',
    enum: NotificationContentType,
  })
  @Prop({
    type: String,
    enum: NotificationContentType,
    default: NotificationContentType.TEMPLATE,
  })
  contentType: NotificationContentType;

  /**
   * The supported channels for this template
   */
  @ApiProperty({
    description: 'The supported channels for this template',
    example: ['in_app', 'websocket'],
    enum: NotificationChannel,
    isArray: true,
  })
  @Prop({
    type: [String],
    enum: NotificationChannel,
    default: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
  })
  supportedChannels: NotificationChannel[];

  /**
   * The default priority for notifications using this template
   */
  @ApiProperty({
    description: 'The default priority for notifications using this template',
    example: 'high',
    enum: NotificationPriority,
  })
  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  defaultPriority: NotificationPriority;

  /**
   * The title template with variable placeholders
   */
  @ApiProperty({
    description: 'The title template with variable placeholders',
    example: 'Your bid of {{bidAmount}} HASH has been outbid!',
  })
  @Prop({
    type: String,
    required: true,
  })
  titleTemplate: string;

  /**
   * The message template with variable placeholders
   */
  @ApiProperty({
    description: 'The message template with variable placeholders',
    example:
      'Hello {{user.name}}, your bid of {{bidAmount}} HASH in the auction "{{auction.title}}" has been outbid. The current highest bid is {{currentBid}} HASH.',
  })
  @Prop({
    type: String,
    required: true,
  })
  messageTemplate: string;

  /**
   * Optional HTML template for rich content
   */
  @ApiProperty({
    description: 'Optional HTML template for rich content',
    example:
      '<div><h3>Bid Outbid</h3><p>Your bid of <strong>{{bidAmount}} HASH</strong> has been outbid.</p></div>',
    required: false,
  })
  @Prop({
    type: String,
    required: false,
  })
  htmlTemplate?: string;

  /**
   * Template for action buttons
   */
  @ApiProperty({
    description: 'Template for action buttons',
    example: [
      {
        id: 'view_auction',
        label: 'View Auction',
        type: 'link',
        url: '/auctions/{{auction.id}}',
        style: 'primary',
      },
      {
        id: 'place_bid',
        label: 'Place New Bid',
        type: 'button',
        action: 'open_bid_modal',
        style: 'secondary',
      },
    ],
    required: false,
  })
  @Prop({
    type: [
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
    default: [],
  })
  actionTemplates: Array<{
    id: string;
    label: string;
    type: 'button' | 'link' | 'dismiss';
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary' | 'danger' | 'success';
  }>;

  /**
   * Template variables definition
   */
  @ApiProperty({
    description: 'Template variables definition',
    example: [
      {
        name: 'bidAmount',
        type: 'number',
        required: true,
        description: 'The amount of the outbid',
      },
      {
        name: 'currentBid',
        type: 'number',
        required: true,
        description: 'The current highest bid amount',
      },
    ],
  })
  @Prop({
    type: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
          enum: ['string', 'number', 'boolean', 'date', 'object'],
          required: true,
        },
        required: { type: Boolean, default: true },
        defaultValue: { type: String, required: false },
        description: { type: String, required: false },
      },
    ],
    default: [],
  })
  variables: TemplateVariable[];

  /**
   * Template rendering configuration
   */
  @ApiProperty({
    description: 'Template rendering configuration',
    example: {
      engine: 'handlebars',
      escapeHtml: true,
      allowedHelpers: ['formatDate', 'formatCurrency'],
    },
  })
  @Prop({
    type: {
      engine: {
        type: String,
        enum: ['handlebars', 'mustache', 'plain'],
        default: 'handlebars',
      },
      escapeHtml: { type: Boolean, default: true },
      allowedHelpers: [String],
      partials: { type: Map, of: String, default: {} },
    },
    default: {
      engine: 'handlebars',
      escapeHtml: true,
      allowedHelpers: [],
      partials: {},
    },
  })
  renderConfig: TemplateRenderConfig;

  /**
   * Whether the template is active
   */
  @ApiProperty({
    description: 'Whether the template is active',
    example: true,
  })
  @Prop({
    type: Boolean,
    default: true,
    index: true,
  })
  isActive: boolean;

  /**
   * Template version for versioning support
   */
  @ApiProperty({
    description: 'Template version for versioning support',
    example: '1.0.0',
  })
  @Prop({
    type: String,
    default: '1.0.0',
  })
  version: string;

  /**
   * Category for organizing templates
   */
  @ApiProperty({
    description: 'Category for organizing templates',
    example: 'auction',
    required: false,
  })
  @Prop({
    type: String,
    required: false,
    index: true,
  })
  category?: string;

  /**
   * Tags for template organization and filtering
   */
  @ApiProperty({
    description: 'Tags for template organization and filtering',
    example: ['auction', 'bidding', 'user_action'],
    required: false,
  })
  @Prop({
    type: [String],
    default: [],
  })
  tags: string[];

  /**
   * Default metadata for notifications using this template
   */
  @ApiProperty({
    description: 'Default metadata for notifications using this template',
    example: { source: 'auction_system', priority: 'high' },
    required: false,
  })
  @Prop({
    type: Map,
    of: String,
    default: {},
  })
  defaultMetadata: Record<string, any>;

  /**
   * Usage statistics
   */
  @ApiProperty({
    description: 'Usage statistics',
    example: {
      totalUsed: 150,
      lastUsed: '2024-03-19T12:00:00.000Z',
      averageDeliveryTime: 250,
      successRate: 0.95,
    },
  })
  @Prop({
    type: {
      totalUsed: { type: Number, default: 0 },
      lastUsed: { type: Date, required: false },
      averageDeliveryTime: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
    },
    default: {
      totalUsed: 0,
      lastUsed: null,
      averageDeliveryTime: 0,
      successRate: 0,
    },
  })
  usage: {
    totalUsed: number;
    lastUsed?: Date;
    averageDeliveryTime: number;
    successRate: number;
  };

  /**
   * The timestamp when the template was created
   */
  @ApiProperty({
    description: 'The timestamp when the template was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the template was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the template was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for NotificationTemplate
 */
export const NotificationTemplateSchema =
  SchemaFactory.createForClass(NotificationTemplate);

// Create indexes for better query performance
NotificationTemplateSchema.index({ templateId: 1 }, { unique: true });
NotificationTemplateSchema.index({ notificationType: 1, isActive: 1 });
NotificationTemplateSchema.index({ category: 1, isActive: 1 });
NotificationTemplateSchema.index({ tags: 1 });
NotificationTemplateSchema.index({ isActive: 1, createdAt: -1 });
NotificationTemplateSchema.index({ 'usage.totalUsed': -1 });
NotificationTemplateSchema.index({ version: 1 });
