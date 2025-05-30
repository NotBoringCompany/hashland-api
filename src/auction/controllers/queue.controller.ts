import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BidQueueService } from '../services/bid-queue.service';
import { QueueMetricsDto } from '../dto/queue.dto';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';

/**
 * Controller for queue monitoring and management
 */
@ApiTags('Queue Management')
@Controller('queue')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueueController {
  constructor(private readonly queueService: BidQueueService) {}

  /**
   * Get queue metrics
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get queue metrics',
    description: 'Retrieve current queue performance metrics and statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue metrics retrieved successfully',
    type: QueueMetricsDto,
  })
  async getMetrics(): Promise<QueueMetricsDto> {
    return this.queueService.getQueueMetrics();
  }

  /**
   * Get queue health status
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get queue health status',
    description: 'Check queue health and identify potential issues',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue health status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isHealthy: { type: 'boolean' },
        metrics: { $ref: '#/components/schemas/QueueMetricsDto' },
        issues: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getHealth(): Promise<{
    isHealthy: boolean;
    metrics: QueueMetricsDto;
    issues: string[];
  }> {
    return this.queueService.getQueueHealth();
  }

  /**
   * Get job status by ID
   */
  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Retrieve detailed status information for a specific job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The ID of the job to retrieve',
    example: '12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        data: { type: 'object' },
        progress: { type: 'number' },
        state: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        processedAt: { type: 'string', format: 'date-time', nullable: true },
        finishedAt: { type: 'string', format: 'date-time', nullable: true },
        failedReason: { type: 'string', nullable: true },
        attemptsMade: { type: 'number' },
        opts: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getJobStatus(@Param('jobId') jobId: string): Promise<any> {
    const status = await this.queueService.getJobStatus(jobId);
    if (!status) {
      throw new Error('Job not found');
    }
    return status;
  }

  /**
   * Retry failed job
   */
  @Post('jobs/:jobId/retry')
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retry a failed job by adding it back to the queue',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The ID of the job to retry',
    example: '12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job retried successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('jobId') jobId: string): Promise<{
    message: string;
    jobId: string;
  }> {
    await this.queueService.retryJob(jobId);
    return {
      message: 'Job retried successfully',
      jobId,
    };
  }

  /**
   * Remove job from queue
   */
  @Delete('jobs/:jobId')
  @ApiOperation({
    summary: 'Remove job',
    description: 'Remove a job from the queue (completed, failed, or waiting)',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The ID of the job to remove',
    example: '12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job removed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async removeJob(@Param('jobId') jobId: string): Promise<{
    message: string;
    jobId: string;
  }> {
    await this.queueService.removeJob(jobId);
    return {
      message: 'Job removed successfully',
      jobId,
    };
  }

  /**
   * Clean up old jobs
   */
  @Post('cleanup')
  @ApiOperation({
    summary: 'Clean up old jobs',
    description: 'Remove completed and failed jobs older than specified time',
  })
  @ApiQuery({
    name: 'olderThan',
    description:
      'Remove jobs older than this many milliseconds (default: 24 hours)',
    required: false,
    example: 86400000,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs cleaned up successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        olderThan: { type: 'number' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async cleanupJobs(@Query('olderThan') olderThan?: number): Promise<{
    message: string;
    olderThan: number;
  }> {
    const cleanupTime = olderThan || 24 * 60 * 60 * 1000; // Default 24 hours
    await this.queueService.cleanupJobs(cleanupTime);
    return {
      message: 'Jobs cleaned up successfully',
      olderThan: cleanupTime,
    };
  }

  /**
   * Pause queue processing
   */
  @Post('pause')
  @ApiOperation({
    summary: 'Pause queue',
    description: 'Pause processing of new jobs in the queue',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue paused successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async pauseQueue(): Promise<{
    message: string;
    status: string;
  }> {
    await this.queueService.pauseQueue();
    return {
      message: 'Queue paused successfully',
      status: 'paused',
    };
  }

  /**
   * Resume queue processing
   */
  @Post('resume')
  @ApiOperation({
    summary: 'Resume queue',
    description: 'Resume processing of jobs in the queue',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue resumed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async resumeQueue(): Promise<{
    message: string;
    status: string;
  }> {
    await this.queueService.resumeQueue();
    return {
      message: 'Queue resumed successfully',
      status: 'active',
    };
  }
}
