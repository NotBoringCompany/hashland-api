import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BidQueueService } from '../services/bid-queue.service';
import { QueueMetricsDto } from '../dto/queue.dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { AdminProtected } from '../../auth/admin';

/**
 * Controller for queue monitoring and management
 */
@ApiTags('Queue Management')
@Controller('queue')
@AdminProtected()
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Queue metrics retrieved successfully',
    type: ApiResponse.withType(QueueMetricsDto),
  })
  async getMetrics(): Promise<ApiResponse<QueueMetricsDto>> {
    const metrics = await this.queueService.getQueueMetrics();
    return new ApiResponse(
      HttpStatus.OK,
      'Queue metrics retrieved successfully',
      metrics,
    );
  }

  /**
   * Get queue health status
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get queue health status',
    description: 'Check queue health and identify potential issues',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Queue health status retrieved successfully',
    type: ApiResponse,
  })
  async getHealth(): Promise<
    ApiResponse<{
      isHealthy: boolean;
      metrics: QueueMetricsDto;
      issues: string[];
    }>
  > {
    const data = await this.queueService.getQueueHealth();
    return new ApiResponse(
      HttpStatus.OK,
      'Queue health status retrieved successfully',
      data,
    );
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Job status retrieved successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
    type: ApiResponse,
  })
  async getJobStatus(@Param('jobId') jobId: string): Promise<ApiResponse<any>> {
    const status = await this.queueService.getJobStatus(jobId);
    if (!status) {
      throw new Error('Job not found');
    }
    return new ApiResponse(
      HttpStatus.OK,
      'Job status retrieved successfully',
      status,
    );
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Job retried successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
    type: ApiResponse,
  })
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('jobId') jobId: string): Promise<
    ApiResponse<{
      message: string;
      jobId: string;
    }>
  > {
    await this.queueService.retryJob(jobId);
    const data = {
      message: 'Job retried successfully',
      jobId,
    };
    return new ApiResponse(HttpStatus.OK, 'Job retried successfully', data);
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Job removed successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
    type: ApiResponse,
  })
  async removeJob(@Param('jobId') jobId: string): Promise<
    ApiResponse<{
      message: string;
      jobId: string;
    }>
  > {
    await this.queueService.removeJob(jobId);
    const data = {
      message: 'Job removed successfully',
      jobId,
    };
    return new ApiResponse(HttpStatus.OK, 'Job removed successfully', data);
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs cleaned up successfully',
    type: ApiResponse,
  })
  @HttpCode(HttpStatus.OK)
  async cleanupJobs(@Query('olderThan') olderThan?: number): Promise<
    ApiResponse<{
      message: string;
      olderThan: number;
    }>
  > {
    const cleanupTime = olderThan || 24 * 60 * 60 * 1000; // Default 24 hours
    await this.queueService.cleanupJobs(cleanupTime);
    const data = {
      message: 'Jobs cleaned up successfully',
      olderThan: cleanupTime,
    };
    return new ApiResponse(HttpStatus.OK, 'Jobs cleaned up successfully', data);
  }

  /**
   * Pause queue processing
   */
  @Post('pause')
  @ApiOperation({
    summary: 'Pause queue',
    description: 'Pause processing of new jobs in the queue',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Queue paused successfully',
    type: ApiResponse,
  })
  @HttpCode(HttpStatus.OK)
  async pauseQueue(): Promise<
    ApiResponse<{
      message: string;
      status: string;
    }>
  > {
    await this.queueService.pauseQueue();
    const data = {
      message: 'Queue paused successfully',
      status: 'paused',
    };
    return new ApiResponse(HttpStatus.OK, 'Queue paused successfully', data);
  }

  /**
   * Resume queue processing
   */
  @Post('resume')
  @ApiOperation({
    summary: 'Resume queue',
    description: 'Resume processing of jobs in the queue',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Queue resumed successfully',
    type: ApiResponse,
  })
  @HttpCode(HttpStatus.OK)
  async resumeQueue(): Promise<
    ApiResponse<{
      message: string;
      status: string;
    }>
  > {
    await this.queueService.resumeQueue();
    const data = {
      message: 'Queue resumed successfully',
      status: 'active',
    };
    return new ApiResponse(HttpStatus.OK, 'Queue resumed successfully', data);
  }
}
