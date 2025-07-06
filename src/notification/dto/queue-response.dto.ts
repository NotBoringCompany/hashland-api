import { ApiProperty } from '@nestjs/swagger';

/**
 * Queue health status response DTO
 */
export class QueueHealthResponseDto {
  @ApiProperty({ example: 'healthy', description: 'Overall health status' })
  status: string;

  @ApiProperty({ example: true, description: 'Whether queue is operational' })
  isHealthy: boolean;

  @ApiProperty({ example: 150, description: 'Total jobs waiting' })
  waitingJobs: number;

  @ApiProperty({ example: 5, description: 'Jobs currently being processed' })
  activeJobs: number;

  @ApiProperty({ example: 1200, description: 'Total completed jobs' })
  completedJobs: number;

  @ApiProperty({ example: 25, description: 'Total failed jobs' })
  failedJobs: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Health check timestamp',
  })
  timestamp: string;

  @ApiProperty({
    example: 'Queue is processing normally',
    description: 'Additional health information',
  })
  message?: string;
}

/**
 * Queue statistics response DTO
 */
export class QueueStatsDto {
  @ApiProperty({ example: 150, description: 'Jobs waiting to be processed' })
  waiting: number;

  @ApiProperty({ example: 5, description: 'Jobs currently active' })
  active: number;

  @ApiProperty({ example: 1200, description: 'Jobs completed successfully' })
  completed: number;

  @ApiProperty({ example: 25, description: 'Jobs that failed' })
  failed: number;

  @ApiProperty({
    example: 10,
    description: 'Jobs delayed for later processing',
  })
  delayed: number;
}

/**
 * Queue metrics response DTO
 */
export class QueueMetricsDto {
  @ApiProperty({
    example: 15.5,
    description: 'Average processing time in seconds',
  })
  avgProcessingTime: number;

  @ApiProperty({ example: 95.5, description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ example: 120, description: 'Jobs processed per hour' })
  throughput: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  lastUpdated: string;
}

/**
 * Job performance metrics DTO
 */
export class JobPerformanceDto {
  @ApiProperty({ example: 8.5, description: 'Average job duration in seconds' })
  avgDuration: number;

  @ApiProperty({ example: 120, description: 'Maximum job duration in seconds' })
  maxDuration: number;

  @ApiProperty({ example: 2.1, description: 'Minimum job duration in seconds' })
  minDuration: number;

  @ApiProperty({ example: 1500, description: 'Total jobs processed' })
  totalProcessed: number;
}

/**
 * Combined queue statistics response DTO
 */
export class QueueStatsResponseDto {
  @ApiProperty({ type: QueueStatsDto, description: 'Basic queue statistics' })
  basicStats: QueueStatsDto;

  @ApiProperty({
    type: QueueMetricsDto,
    description: 'Queue performance metrics',
  })
  metrics: QueueMetricsDto;

  @ApiProperty({ type: JobPerformanceDto, description: 'Job performance data' })
  performance: JobPerformanceDto;
}

/**
 * Job details response DTO
 */
export class JobDetailsResponseDto {
  @ApiProperty({ example: '12345', description: 'Unique job identifier' })
  id: string;

  @ApiProperty({ example: 'notification', description: 'Job name/type' })
  name: string;

  @ApiProperty({
    example: { recipientId: '507f1f77bcf86cd799439011', type: 'auction_bid' },
    description: 'Job data payload',
  })
  data: any;

  @ApiProperty({
    example: { attempts: 3, delay: 5000 },
    description: 'Job options and configuration',
  })
  opts: any;

  @ApiProperty({ example: 100, description: 'Job completion percentage' })
  progress: number;

  @ApiProperty({ example: 1, description: 'Number of attempts made' })
  attemptsMade: number;

  @ApiProperty({
    example: 1705312200000,
    description: 'Job creation timestamp',
  })
  timestamp: number;

  @ApiProperty({
    example: 1705312250000,
    description: 'Job processing start timestamp',
  })
  processedOn?: number;

  @ApiProperty({
    example: 1705312260000,
    description: 'Job completion timestamp',
  })
  finishedOn?: number;

  @ApiProperty({
    example: 'Network timeout',
    description: 'Failure reason if job failed',
  })
  failedReason?: string;
}

/**
 * Cached metrics response DTO
 */
export class CachedMetricsResponseDto {
  @ApiProperty({ type: QueueMetricsDto, description: 'Cached queue metrics' })
  metrics: QueueMetricsDto;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Cache timestamp',
  })
  cachedAt: string;

  @ApiProperty({ example: 3600, description: 'Cache TTL in seconds' })
  ttl: number;

  @ApiProperty({ example: true, description: 'Whether cache data is fresh' })
  isFresh: boolean;
}
