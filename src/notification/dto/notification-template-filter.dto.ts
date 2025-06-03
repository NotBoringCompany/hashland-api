import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NotificationContentType,
  NotificationChannel,
} from '../types/notification.types';

/**
 * DTO for filtering notification templates
 */
export class NotificationTemplateFilterDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search term for template name or description',
    example: 'auction',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by notification type',
    enum: NotificationType,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  notificationType?: NotificationType;

  @ApiProperty({
    description: 'Filter by content type',
    enum: NotificationContentType,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationContentType)
  contentType?: NotificationContentType;

  @ApiProperty({
    description: 'Filter by supported channel',
    enum: NotificationChannel,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiProperty({
    description: 'Filter by category',
    example: 'auction',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Filter by active status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Filter by template version',
    example: '1.0.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({
    description: 'Filter by tag',
    example: 'auction',
    required: false,
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({
    description: 'Sort field',
    enum: ['name', 'createdAt', 'updatedAt', 'usage.totalUsed'],
    example: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt', 'usage.totalUsed'])
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    required: false,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
