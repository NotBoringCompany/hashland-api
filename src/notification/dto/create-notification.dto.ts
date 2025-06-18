import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Types } from 'mongoose';
import {
  NotificationType,
  NotificationPriority,
  NotificationContentType,
  NotificationChannel,
  NotificationAction,
} from '../types/notification.types';

/**
 * DTO for notification content data
 */
export class NotificationContentDataDto {
  @ApiProperty({
    description: 'The title of the notification',
    example: 'New Bid Placed',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The message content of the notification',
    example: 'Your bid has been outbid in the auction',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    example: { auctionId: '507f1f77bcf86cd799439014', bidAmount: 250 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Action buttons for the notification',
    type: [Object],
    example: [
      {
        id: 'view_auction',
        label: 'View Auction',
        type: 'link',
        url: '/auctions/123',
        style: 'primary',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  actions?: NotificationAction[];

  @ApiPropertyOptional({
    description: 'Template information for dynamic content',
    example: {
      templateId: 'auction_bid_outbid',
      variables: { bidAmount: 250, auctionTitle: 'Rare NFT' },
    },
  })
  @IsOptional()
  @IsObject()
  template?: {
    templateId: string;
    variables: Record<string, any>;
  };

  @ApiPropertyOptional({
    description: 'Image URL for the notification',
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Icon URL for the notification',
    example: 'https://example.com/icon.png',
  })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}

/**
 * DTO for notification content
 */
export class NotificationContentDto {
  @ApiProperty({
    description: 'The type of notification content',
    example: 'text',
    enum: NotificationContentType,
  })
  @IsEnum(NotificationContentType)
  type: NotificationContentType;

  @ApiProperty({
    description: 'The content data of the notification',
    type: NotificationContentDataDto,
  })
  @ValidateNested()
  @Type(() => NotificationContentDataDto)
  data: NotificationContentDataDto;
}

/**
 * DTO for notification targeting criteria
 */
export class NotificationTargetDto {
  @ApiPropertyOptional({
    description: 'Specific user IDs to target',
    type: [String],
    example: ['507f1f77bcf86cd799439012'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @Transform(({ value }) => value?.map((id: string) => new Types.ObjectId(id)))
  userIds?: Types.ObjectId[];

  @ApiPropertyOptional({
    description: 'User roles to target',
    type: [String],
    example: ['premium', 'admin'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({
    description: 'Advanced targeting criteria',
    example: {
      level: { min: 5, max: 10 },
      registeredAfter: '2024-01-01T00:00:00.000Z',
    },
  })
  @IsOptional()
  @IsObject()
  criteria?: {
    level?: { min?: number; max?: number };
    registeredAfter?: Date;
    lastActiveAfter?: Date;
    hasCompletedActions?: string[];
    metadata?: Record<string, any>;
  };
}

/**
 * DTO for notification scheduling
 */
export class NotificationScheduleDto {
  @ApiPropertyOptional({
    description: 'When to send the notification',
    example: '2024-03-19T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: Date;

  @ApiPropertyOptional({
    description: 'Timezone for scheduling',
    example: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Recurring notification settings',
    example: {
      pattern: 'daily',
      interval: 1,
      endDate: '2024-12-31T23:59:59.000Z',
    },
  })
  @IsOptional()
  @IsObject()
  recurring?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
  };
}

/**
 * DTO for creating a notification
 */
export class CreateNotificationDto {
  @ApiProperty({
    description: 'The type of notification',
    example: 'auction_bid',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'The priority level of the notification',
    example: 'high',
    enum: NotificationPriority,
  })
  @IsEnum(NotificationPriority)
  priority: NotificationPriority;

  @ApiProperty({
    description: 'The recipient user ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  recipientId: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'The sender user ID (optional for system notifications)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value ? new Types.ObjectId(value) : undefined))
  senderId?: Types.ObjectId;

  @ApiProperty({
    description: 'The content of the notification',
    type: NotificationContentDto,
  })
  @ValidateNested()
  @Type(() => NotificationContentDto)
  content: NotificationContentDto;

  @ApiPropertyOptional({
    description: 'Delivery channels for the notification',
    type: [String],
    enum: NotificationChannel,
    example: ['in_app', 'websocket'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'When the notification expires',
    example: '2024-04-19T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Reference to related entity',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value ? new Types.ObjectId(value) : undefined))
  relatedEntityId?: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Type of the related entity',
    example: 'auction',
  })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiPropertyOptional({
    description: 'Scheduling information for the notification',
    type: NotificationScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  schedule?: NotificationScheduleDto;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    example: { source: 'auction_system', version: '1.0' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for creating bulk notifications
 */
export class CreateBulkNotificationDto {
  @ApiProperty({
    description: 'The type of notification',
    example: 'system_alert',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'The priority level of the notification',
    example: 'high',
    enum: NotificationPriority,
  })
  @IsEnum(NotificationPriority)
  priority: NotificationPriority;

  @ApiPropertyOptional({
    description: 'The sender user ID (optional for system notifications)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value ? new Types.ObjectId(value) : undefined))
  senderId?: Types.ObjectId;

  @ApiProperty({
    description: 'The content of the notification',
    type: NotificationContentDto,
  })
  @ValidateNested()
  @Type(() => NotificationContentDto)
  content: NotificationContentDto;

  @ApiProperty({
    description: 'Targeting criteria for recipients',
    type: NotificationTargetDto,
  })
  @ValidateNested()
  @Type(() => NotificationTargetDto)
  target: NotificationTargetDto;

  @ApiPropertyOptional({
    description: 'Delivery channels for the notification',
    type: [String],
    enum: NotificationChannel,
    example: ['in_app', 'websocket'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'When the notification expires',
    example: '2024-04-19T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Scheduling information for the notification',
    type: NotificationScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  schedule?: NotificationScheduleDto;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    example: { source: 'admin_system', campaign: 'maintenance_alert' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Maximum number of notifications to send (for testing)',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  maxRecipients?: number;
}
