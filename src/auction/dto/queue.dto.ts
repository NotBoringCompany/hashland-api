import {
  IsMongoId,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BidType } from '../schemas/bid.schema';

/**
 * Priority levels for queue jobs
 */
export enum QueuePriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20,
}

/**
 * Queue job status
 */
export enum QueueJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * DTO for bid queue job data
 */
export class BidQueueJobDto {
  @ApiProperty({
    description: 'The ID of the auction',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;

  @ApiProperty({
    description: 'The ID of the bidder',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  bidderId: string;

  @ApiProperty({
    description: 'The bid amount in HASH currency',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'The type of bid',
    enum: BidType,
    example: BidType.REGULAR,
    required: false,
  })
  @IsOptional()
  @IsEnum(BidType)
  bidType?: BidType;

  @ApiProperty({
    description: 'Job priority level',
    enum: QueuePriority,
    example: QueuePriority.MEDIUM,
    required: false,
  })
  @IsOptional()
  @IsEnum(QueuePriority)
  priority?: QueuePriority;

  @ApiProperty({
    description: 'Source of the bid request',
    example: 'websocket',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    description: 'Client IP address',
    example: '192.168.1.1',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientIp?: string;

  @ApiProperty({
    description: 'User agent string',
    example: 'Mozilla/5.0...',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({
    description: 'Socket ID for WebSocket bids',
    example: 'socket_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  socketId?: string;

  @ApiProperty({
    description: 'Timestamp when the bid was submitted',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsString()
  timestamp: string;
}

/**
 * DTO for queue job result
 */
export class QueueJobResultDto {
  @ApiProperty({
    description: 'Whether the job was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The created bid ID if successful',
    example: '507f1f77bcf86cd799439014',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  bidId?: string;

  @ApiProperty({
    description: 'Error message if failed',
    example: 'Insufficient balance',
    required: false,
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 150,
  })
  @IsNumber()
  processingTime: number;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 0,
  })
  @IsNumber()
  retryCount: number;

  @ApiProperty({
    description: 'Timestamp when processing completed',
    example: '2024-03-19T12:00:00.500Z',
  })
  @IsString()
  completedAt: string;
}

/**
 * DTO for queue metrics
 */
export class QueueMetricsDto {
  @ApiProperty({
    description: 'Number of jobs waiting in queue',
    example: 25,
  })
  @IsNumber()
  waiting: number;

  @ApiProperty({
    description: 'Number of jobs currently being processed',
    example: 5,
  })
  @IsNumber()
  active: number;

  @ApiProperty({
    description: 'Number of completed jobs',
    example: 1000,
  })
  @IsNumber()
  completed: number;

  @ApiProperty({
    description: 'Number of failed jobs',
    example: 10,
  })
  @IsNumber()
  failed: number;

  @ApiProperty({
    description: 'Average processing time in milliseconds',
    example: 125.5,
  })
  @IsNumber()
  averageProcessingTime: number;

  @ApiProperty({
    description: 'Jobs processed per minute',
    example: 45.2,
  })
  @IsNumber()
  throughput: number;
}

/**
 * DTO for queue configuration
 */
export class QueueConfigDto {
  @ApiProperty({
    description: 'Maximum number of concurrent jobs',
    example: 10,
  })
  @IsNumber()
  concurrency: number;

  @ApiProperty({
    description: 'Maximum number of retry attempts',
    example: 3,
  })
  @IsNumber()
  maxRetries: number;

  @ApiProperty({
    description: 'Delay between retries in milliseconds',
    example: 5000,
  })
  @IsNumber()
  retryDelay: number;

  @ApiProperty({
    description: 'Job timeout in milliseconds',
    example: 30000,
  })
  @IsNumber()
  jobTimeout: number;
}
