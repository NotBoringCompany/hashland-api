import { IsEnum, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuctionStatus } from '../schemas/auction.schema';

/**
 * DTO for lifecycle status response
 */
export class LifecycleStatusDto {
  @ApiProperty({
    description: 'Current auction status',
    enum: AuctionStatus,
    example: AuctionStatus.WHITELIST_OPEN,
  })
  @IsEnum(AuctionStatus)
  currentStatus: AuctionStatus;

  @ApiProperty({
    description: 'Next scheduled transition',
    required: false,
    type: Object,
  })
  @IsOptional()
  nextTransition?: {
    status: AuctionStatus;
    scheduledTime: Date;
    timeUntil: number;
  };

  @ApiProperty({
    description: 'Complete auction lifecycle timeline',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(AuctionStatus) },
        time: { type: 'string', format: 'date-time' },
        completed: { type: 'boolean' },
      },
    },
  })
  timeline: Array<{
    status: AuctionStatus;
    time: Date;
    completed: boolean;
  }>;
}

/**
 * DTO for state transition response
 */
export class StateTransitionDto {
  @ApiProperty({
    description: 'Whether the transition was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Transition result message',
    example: 'Auction transitioned to WHITELIST_OPEN',
  })
  message: string;

  @ApiProperty({
    description: 'New auction status after transition',
    enum: AuctionStatus,
    required: false,
    example: AuctionStatus.WHITELIST_OPEN,
  })
  @IsOptional()
  @IsEnum(AuctionStatus)
  newStatus?: AuctionStatus;

  @ApiProperty({
    description: 'Timestamp of the transition',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;
}

/**
 * DTO for lifecycle processing status
 */
export class LifecycleProcessingStatusDto {
  @ApiProperty({
    description: 'Whether lifecycle processing is running',
    example: true,
  })
  @IsBoolean()
  isRunning: boolean;

  @ApiProperty({
    description: 'Last processing timestamp',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsDateString()
  lastProcessed: string;

  @ApiProperty({
    description: 'Next scheduled processing timestamp',
    example: '2024-03-19T12:01:00.000Z',
  })
  @IsDateString()
  nextScheduled: string;

  @ApiProperty({
    description: 'Processing interval description',
    example: 'Every minute',
  })
  processingInterval: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Lifecycle processing is active and running automatically',
  })
  message: string;
}

/**
 * DTO for lifecycle event details
 */
export class LifecycleEventDto {
  @ApiProperty({
    description: 'Event type',
    example: 'whitelist_opened',
  })
  type: string;

  @ApiProperty({
    description: 'Previous auction status',
    enum: AuctionStatus,
    example: AuctionStatus.DRAFT,
  })
  @IsEnum(AuctionStatus)
  previousStatus: AuctionStatus;

  @ApiProperty({
    description: 'New auction status',
    enum: AuctionStatus,
    example: AuctionStatus.WHITELIST_OPEN,
  })
  @IsEnum(AuctionStatus)
  newStatus: AuctionStatus;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Additional event details',
    required: false,
    type: Object,
  })
  @IsOptional()
  details?: any;
}

/**
 * DTO for auction timeline item
 */
export class AuctionTimelineItemDto {
  @ApiProperty({
    description: 'Auction status for this timeline item',
    enum: AuctionStatus,
    example: AuctionStatus.WHITELIST_OPEN,
  })
  @IsEnum(AuctionStatus)
  status: AuctionStatus;

  @ApiProperty({
    description: 'Scheduled time for this status',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsDateString()
  time: Date;

  @ApiProperty({
    description: 'Whether this status has been completed',
    example: true,
  })
  @IsBoolean()
  completed: boolean;

  @ApiProperty({
    description: 'Duration in this status (milliseconds)',
    required: false,
    example: 3600000,
  })
  @IsOptional()
  duration?: number;

  @ApiProperty({
    description: 'Status description',
    required: false,
    example: 'Whitelist registration period',
  })
  @IsOptional()
  description?: string;
}
