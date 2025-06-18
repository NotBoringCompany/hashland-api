import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsMongoId,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Types } from 'mongoose';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
} from '../types/notification.types';

/**
 * DTO for filtering notifications
 */
export class NotificationFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
    example: 'auction_bid',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Filter by notification types (multiple)',
    enum: NotificationType,
    isArray: true,
    example: ['auction_bid', 'transaction'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  types?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Filter by priority level',
    enum: NotificationPriority,
    example: 'high',
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Filter by priority levels (multiple)',
    enum: NotificationPriority,
    isArray: true,
    example: ['high', 'critical'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationPriority, { each: true })
  priorities?: NotificationPriority[];

  @ApiPropertyOptional({
    description: 'Filter by read status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by sender ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  senderId?: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Filter by related entity ID',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  relatedEntityId?: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Filter by related entity type',
    example: 'auction',
  })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiPropertyOptional({
    description: 'Filter by delivery channel',
    enum: NotificationChannel,
    example: 'websocket',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: NotificationStatus,
    example: 'delivered',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  deliveryStatus?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Filter notifications created after this date',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter notifications created before this date',
    example: '2024-03-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: Date;

  @ApiPropertyOptional({
    description: 'Filter notifications that expire after this date',
    example: '2024-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter notifications that expire before this date',
    example: '2024-04-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresBefore?: Date;

  @ApiPropertyOptional({
    description: 'Search in notification title and message',
    example: 'bid auction',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by metadata key-value pairs',
    example: 'source:auction_system',
  })
  @IsOptional()
  @IsString()
  metadata?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'priority', 'type', 'isRead'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Include analytics data',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeAnalytics?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include delivery tracking data',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeDelivery?: boolean = true;
}

/**
 * DTO for marking notifications as read
 */
export class MarkNotificationsReadDto {
  @ApiPropertyOptional({
    description: 'Specific notification IDs to mark as read',
    type: [String],
    example: ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @Transform(({ value }) => value?.map((id: string) => new Types.ObjectId(id)))
  notificationIds?: Types.ObjectId[];

  @ApiPropertyOptional({
    description: 'Mark all notifications as read (ignores notificationIds)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  markAll?: boolean = false;

  @ApiPropertyOptional({
    description: 'Only mark notifications of specific types as read',
    enum: NotificationType,
    isArray: true,
    example: ['auction_bid', 'transaction'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  types?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Only mark notifications created before this date as read',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: Date;
}

/**
 * DTO for notification analytics query
 */
export class NotificationAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Start date for analytics period',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date for analytics period',
    example: '2024-03-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Group by field for analytics',
    example: 'type',
    enum: ['type', 'priority', 'channel', 'date', 'hour'],
  })
  @IsOptional()
  @IsString()
  groupBy?: 'type' | 'priority' | 'channel' | 'date' | 'hour';

  @ApiPropertyOptional({
    description: 'Filter by notification types',
    enum: NotificationType,
    isArray: true,
    example: ['auction_bid', 'transaction'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  types?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Filter by delivery channels',
    enum: NotificationChannel,
    isArray: true,
    example: ['websocket', 'in_app'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'Include detailed metrics',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeDetails?: boolean = false;
}

/**
 * DTO for unread notification count
 */
export class UnreadCountDto {
  @ApiPropertyOptional({
    description: 'Group count by notification type',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  groupByType?: boolean = false;

  @ApiPropertyOptional({
    description: 'Group count by priority',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  groupByPriority?: boolean = false;

  @ApiPropertyOptional({
    description: 'Only count notifications of specific types',
    enum: NotificationType,
    isArray: true,
    example: ['auction_bid', 'transaction'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  types?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Only count notifications with minimum priority',
    enum: NotificationPriority,
    example: 'medium',
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  minPriority?: NotificationPriority;
}
