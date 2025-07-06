import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NotificationPriority,
  NotificationContentType,
  NotificationChannel,
} from '../types/notification.types';

/**
 * DTO for template action definition
 */
export class TemplateActionDto {
  @ApiProperty({
    description: 'Unique identifier for the action',
    example: 'view_auction',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Label template for the action button',
    example: 'View {{auction.title}}',
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Type of action',
    enum: ['button', 'link', 'dismiss'],
    example: 'link',
  })
  @IsEnum(['button', 'link', 'dismiss'])
  type: 'button' | 'link' | 'dismiss';

  @ApiProperty({
    description: 'URL template for link actions',
    example: '/auctions/{{auction.id}}',
    required: false,
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({
    description: 'Action identifier for button actions',
    example: 'open_bid_modal',
    required: false,
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({
    description: 'Visual style of the action button',
    enum: ['primary', 'secondary', 'danger', 'success'],
    example: 'primary',
    required: false,
  })
  @IsOptional()
  @IsEnum(['primary', 'secondary', 'danger', 'success'])
  style?: 'primary' | 'secondary' | 'danger' | 'success';
}

/**
 * DTO for template variable definition
 */
export class TemplateVariableDto {
  @ApiProperty({
    description: 'Variable name',
    example: 'bidAmount',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Variable type',
    enum: ['string', 'number', 'boolean', 'date', 'object'],
    example: 'number',
  })
  @IsEnum(['string', 'number', 'boolean', 'date', 'object'])
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';

  @ApiProperty({
    description: 'Whether the variable is required',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiProperty({
    description: 'Default value for the variable',
    example: '0',
    required: false,
  })
  @IsOptional()
  defaultValue?: any;

  @ApiProperty({
    description: 'Description of the variable',
    example: 'The amount of the bid that was outbid',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for creating notification templates
 */
export class CreateNotificationTemplateDto {
  @ApiProperty({
    description: 'Unique identifier for the template',
    example: 'auction_bid_outbid',
  })
  @IsString()
  templateId: string;

  @ApiProperty({
    description: 'Human-readable name of the template',
    example: 'Auction Bid Outbid Notification',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the template',
    example: 'Template for notifying users when their bid is outbid',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The notification type this template is for',
    enum: NotificationType,
    example: NotificationType.AUCTION_BID,
  })
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @ApiProperty({
    description: 'The content type of the template',
    enum: NotificationContentType,
    example: NotificationContentType.TEMPLATE,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationContentType)
  contentType?: NotificationContentType;

  @ApiProperty({
    description: 'The supported channels for this template',
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  supportedChannels?: NotificationChannel[];

  @ApiProperty({
    description: 'The default priority for notifications using this template',
    enum: NotificationPriority,
    example: NotificationPriority.HIGH,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  defaultPriority?: NotificationPriority;

  @ApiProperty({
    description: 'The title template with variable placeholders',
    example: 'Your bid of {{bidAmount}} HASH has been outbid!',
  })
  @IsString()
  titleTemplate: string;

  @ApiProperty({
    description: 'The message template with variable placeholders',
    example:
      'Hello {{user.name}}, your bid of {{bidAmount}} HASH in the auction "{{auction.title}}" has been outbid.',
  })
  @IsString()
  messageTemplate: string;

  @ApiProperty({
    description: 'Optional HTML template for rich content',
    example:
      '<div><h3>Bid Outbid</h3><p>Your bid of <strong>{{bidAmount}} HASH</strong> has been outbid.</p></div>',
    required: false,
  })
  @IsOptional()
  @IsString()
  htmlTemplate?: string;

  @ApiProperty({
    description: 'Template for action buttons',
    type: [TemplateActionDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateActionDto)
  actionTemplates?: TemplateActionDto[];

  @ApiProperty({
    description: 'Template variables definition',
    type: [TemplateVariableDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  @ApiProperty({
    description: 'Template rendering configuration',
    example: {
      engine: 'handlebars',
      escapeHtml: true,
      allowedHelpers: ['formatDate', 'formatCurrency'],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  renderConfig?: {
    engine: 'handlebars' | 'mustache' | 'plain';
    escapeHtml: boolean;
    allowedHelpers?: string[];
    partials?: Record<string, string>;
  };

  @ApiProperty({
    description: 'Whether the template is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Template version for versioning support',
    example: '1.0.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({
    description: 'Category for organizing templates',
    example: 'auction',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Tags for template organization and filtering',
    example: ['auction', 'bidding', 'user_action'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Default metadata for notifications using this template',
    example: { source: 'auction_system', priority: 'high' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  defaultMetadata?: Record<string, any>;
}
