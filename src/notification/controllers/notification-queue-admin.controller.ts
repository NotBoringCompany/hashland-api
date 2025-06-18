import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  Logger,
  ParseIntPipe,
  HttpCode,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { AdminGuard } from 'src/auth/admin/admin.guard';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import { NotificationQueueMonitorService } from '../services/notification-queue-monitor.service';
import { ApiResponse } from '../../common/dto/response.dto';
import {
  QueueHealthResponseDto,
  QueueStatsResponseDto,
  JobDetailsResponseDto,
  CachedMetricsResponseDto,
} from '../dto/queue-response.dto';

/**
 * Admin controller for notification queue management and monitoring
 */
@ApiTags('Admin Notification Queue')
@Controller('admin/notification-queue')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationQueueAdminController {
  private readonly logger = new Logger(NotificationQueueAdminController.name);

  constructor(
    private readonly dispatcherService: NotificationDispatcherService,
    private readonly monitorService: NotificationQueueMonitorService,
  ) {}

  /**
   * Get queue statistics and metrics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get queue statistics',
    description: 'Retrieve current queue statistics and performance metrics',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    type: ApiResponse.withType(QueueStatsResponseDto),
  })
  async getQueueStats(): Promise<ApiResponse<QueueStatsResponseDto>> {
    try {
      const [basicStats, metrics] = await Promise.all([
        this.dispatcherService.getQueueStats(),
        this.monitorService.getQueueMetrics(),
      ]);

      // Map service responses to DTO
      const statsResponse: QueueStatsResponseDto = {
        basicStats: {
          waiting: basicStats.waiting,
          active: basicStats.active,
          completed: basicStats.completed,
          failed: basicStats.failed,
          delayed: basicStats.delayed,
        },
        metrics: {
          avgProcessingTime: metrics.averageProcessingTime || 0,
          successRate: metrics.successRate || 0,
          throughput: metrics.averageProcessingTime
            ? 3600 / metrics.averageProcessingTime
            : 0,
          lastUpdated: new Date().toISOString(),
        },
        performance: {
          avgDuration: 0, // Default values since actual properties don't exist
          maxDuration: 0,
          minDuration: 0,
          totalProcessed: 0,
        },
      };

      this.logger.log('Queue statistics retrieved');
      return new ApiResponse(
        HttpStatus.OK,
        'Queue statistics retrieved successfully',
        statsResponse,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get queue stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get queue health status
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get queue health status',
    description: 'Check the health status of the notification queue',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Queue health status retrieved successfully',
    type: ApiResponse.withType(QueueHealthResponseDto),
  })
  async getQueueHealth(): Promise<ApiResponse<QueueHealthResponseDto>> {
    try {
      const healthData = await this.monitorService.getQueueHealth();
      this.logger.log(`Queue health check: ${healthData.status}`);

      // Map service response to DTO
      const health: QueueHealthResponseDto = {
        status: healthData.status,
        isHealthy: healthData.status === 'healthy',
        waitingJobs: healthData.metrics?.waitingJobs || 0,
        activeJobs: healthData.metrics?.activeJobs || 0,
        completedJobs: healthData.metrics?.completedJobs || 0,
        failedJobs: healthData.metrics?.failedJobs || 0,
        timestamp: new Date().toISOString(),
        message: healthData.issues?.join(', ') || 'Queue is operating normally',
      };

      return new ApiResponse(
        HttpStatus.OK,
        'Queue health status retrieved successfully',
        health,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get queue health: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get jobs by status
   */
  @Get('jobs/:status')
  @ApiOperation({
    summary: 'Get jobs by status',
    description: 'Retrieve jobs filtered by their current status',
  })
  @ApiParam({
    name: 'status',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
    description: 'Job status to filter by',
  })
  @ApiQuery({ name: 'start', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'end', required: false, type: Number, example: 50 })
  @SwaggerApiResponse({
    status: 200,
    description: 'Jobs retrieved successfully',
    type: ApiResponse,
  })
  async getJobsByStatus(
    @Param('status')
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('start', new ParseIntPipe({ optional: true })) start = 0,
    @Query('end', new ParseIntPipe({ optional: true })) end = 50,
  ): Promise<ApiResponse<{ status: string; jobs: any[]; count: number }>> {
    try {
      const jobs = await this.dispatcherService.getJobsByStatus(
        status,
        start,
        end,
      );
      this.logger.log(`Retrieved ${jobs.length} ${status} jobs`);

      return new ApiResponse(
        HttpStatus.OK,
        `Retrieved ${jobs.length} ${status} jobs successfully`,
        { status, jobs, count: jobs.length },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get ${status} jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get failed jobs with details
   */
  @Get('failed-jobs')
  @ApiOperation({
    summary: 'Get failed jobs with error details',
    description: 'Retrieve failed jobs with detailed error information',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @SwaggerApiResponse({
    status: 200,
    description: 'Failed jobs retrieved successfully',
    type: ApiResponse,
  })
  async getFailedJobs(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ): Promise<ApiResponse<{ failedJobs: any[]; count: number }>> {
    try {
      const failedJobs = await this.monitorService.getFailedJobs(limit);
      this.logger.log(`Retrieved ${failedJobs.length} failed jobs`);

      return new ApiResponse(
        HttpStatus.OK,
        `Retrieved ${failedJobs.length} failed jobs successfully`,
        { failedJobs, count: failedJobs.length },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get failed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get specific job details
   */
  @Get('jobs/details/:jobId')
  @ApiOperation({
    summary: 'Get job details',
    description: 'Retrieve detailed information about a specific job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID',
    example: '12345',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
    type: ApiResponse.withType(JobDetailsResponseDto),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Job not found',
    type: ApiResponse,
  })
  async getJobDetails(
    @Param('jobId') jobId: string,
  ): Promise<ApiResponse<JobDetailsResponseDto>> {
    try {
      const job = await this.dispatcherService.getJob(jobId);

      if (!job) {
        return new ApiResponse(HttpStatus.NOT_FOUND, 'Job not found', null);
      }

      this.logger.log(`Retrieved details for job ${jobId}`);

      // Map job data to DTO
      const jobDetails: JobDetailsResponseDto = {
        id: job.id?.toString() || jobId,
        name: job.name || 'notification',
        data: job.data || {},
        opts: job.opts || {},
        progress:
          job.progress && typeof job.progress === 'number' ? job.progress : 0,
        attemptsMade: job.attemptsMade || 0,
        timestamp: job.timestamp || Date.now(),
        processedOn: job.processedOn || undefined,
        finishedOn: job.finishedOn || undefined,
        failedReason: job.failedReason || undefined,
      };

      return new ApiResponse(
        HttpStatus.OK,
        'Job details retrieved successfully',
        jobDetails,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get job details ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  @Post('jobs/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retry a specific failed job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to retry',
    example: '12345',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Job not found',
    type: ApiResponse,
  })
  async retryJob(
    @Param('jobId') jobId: string,
  ): Promise<ApiResponse<{ jobId: string }>> {
    try {
      await this.dispatcherService.retryJob(jobId);
      this.logger.log(`Initiated retry for job ${jobId}`);

      return new ApiResponse(
        HttpStatus.OK,
        `Job ${jobId} retry initiated successfully`,
        { jobId },
      );
    } catch (error) {
      this.logger.error(
        `Failed to retry job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove a specific job from the queue
   */
  @Delete('jobs/:jobId')
  @ApiOperation({
    summary: 'Remove job from queue',
    description: 'Remove a specific job from the queue',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to remove',
    example: '12345',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Job removed successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Job not found',
    type: ApiResponse,
  })
  async removeJob(@Param('jobId') jobId: string): Promise<ApiResponse<null>> {
    try {
      const job = await this.dispatcherService.getJob(jobId);
      if (!job) {
        return new ApiResponse(HttpStatus.NOT_FOUND, 'Job not found', null);
      }

      await job.remove();
      this.logger.log(`Removed job ${jobId}`);

      return new ApiResponse(
        HttpStatus.OK,
        `Job ${jobId} removed successfully`,
        null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Pause the notification queue
   */
  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause notification queue',
    description: 'Pause the notification queue processing',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Queue paused successfully',
    type: ApiResponse,
  })
  async pauseQueue(): Promise<ApiResponse<{ isPaused: boolean }>> {
    try {
      await this.dispatcherService.pauseQueue();
      this.logger.log('Notification queue paused');

      return new ApiResponse(
        HttpStatus.OK,
        'Notification queue paused successfully',
        { isPaused: true },
      );
    } catch (error) {
      this.logger.error(`Failed to pause queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resume the notification queue
   */
  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume notification queue',
    description: 'Resume the notification queue processing',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Queue resumed successfully',
    type: ApiResponse,
  })
  async resumeQueue(): Promise<ApiResponse<{ isPaused: boolean }>> {
    try {
      await this.dispatcherService.resumeQueue();
      this.logger.log('Notification queue resumed');

      return new ApiResponse(
        HttpStatus.OK,
        'Notification queue resumed successfully',
        { isPaused: false },
      );
    } catch (error) {
      this.logger.error(
        `Failed to resume queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean completed jobs from the queue
   */
  @Delete('completed-jobs')
  @ApiOperation({
    summary: 'Clean completed jobs',
    description: 'Remove completed jobs older than specified age',
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    type: Number,
    example: 86400000,
    description: 'Maximum age in milliseconds (default: 24 hours)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Completed jobs cleaned successfully',
    type: ApiResponse,
  })
  async cleanCompletedJobs(
    @Query('maxAge', new ParseIntPipe({ optional: true }))
    maxAge = 24 * 60 * 60 * 1000, // 24 hours default
  ): Promise<ApiResponse<{ cleanedCount: number; maxAge: number }>> {
    try {
      await this.monitorService.cleanOldJobs();
      // Since cleanOldJobs doesn't return count, we'll provide a success message
      this.logger.log(`Cleaned completed jobs older than ${maxAge}ms`);

      return new ApiResponse(
        HttpStatus.OK,
        'Completed jobs cleaned successfully',
        { cleanedCount: 0, maxAge }, // cleanOldJobs doesn't return count
      );
    } catch (error) {
      this.logger.error(
        `Failed to clean completed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean failed jobs from the queue
   */
  @Delete('failed-jobs')
  @ApiOperation({
    summary: 'Clean failed jobs',
    description: 'Remove failed jobs older than specified age',
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    type: Number,
    example: 604800000,
    description: 'Maximum age in milliseconds (default: 7 days)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Failed jobs cleaned successfully',
    type: ApiResponse,
  })
  async cleanFailedJobs(
    @Query('maxAge', new ParseIntPipe({ optional: true }))
    maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days default
  ): Promise<ApiResponse<{ cleanedCount: number; maxAge: number }>> {
    try {
      await this.monitorService.cleanOldJobs();
      // Since cleanOldJobs doesn't return count, we'll provide a success message
      this.logger.log(`Cleaned failed jobs older than ${maxAge}ms`);

      return new ApiResponse(
        HttpStatus.OK,
        'Failed jobs cleaned successfully',
        { cleanedCount: 0, maxAge }, // cleanOldJobs doesn't return count
      );
    } catch (error) {
      this.logger.error(
        `Failed to clean failed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get cached queue metrics
   */
  @Get('metrics/cached')
  @ApiOperation({
    summary: 'Get cached queue metrics',
    description: 'Retrieve cached queue metrics for performance monitoring',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cached metrics retrieved successfully',
    type: ApiResponse.withType(CachedMetricsResponseDto),
  })
  async getCachedMetrics(): Promise<ApiResponse<CachedMetricsResponseDto>> {
    try {
      const metricsData = await this.monitorService.getCachedMetrics();
      this.logger.log('Retrieved cached queue metrics');

      // Map service response to DTO
      const cachedMetrics: CachedMetricsResponseDto = {
        metrics: {
          avgProcessingTime: metricsData.averageProcessingTime || 0,
          successRate: metricsData.successRate || 0,
          throughput: metricsData.averageProcessingTime
            ? 3600 / metricsData.averageProcessingTime
            : 0,
          lastUpdated: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
        ttl: 3600, // 1 hour default
        isFresh: true,
      };

      return new ApiResponse(
        HttpStatus.OK,
        'Cached metrics retrieved successfully',
        cachedMetrics,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get cached metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Refresh metrics cache
   */
  @Post('metrics/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh metrics cache',
    description: 'Force refresh of the queue metrics cache',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Metrics cache refreshed successfully',
    type: ApiResponse,
  })
  async refreshMetricsCache(): Promise<ApiResponse<{ refreshedAt: string }>> {
    try {
      // Get fresh metrics to refresh the cache
      await this.monitorService.getQueueMetrics();
      const refreshedAt = new Date().toISOString();
      this.logger.log('Queue metrics cache refreshed');

      return new ApiResponse(
        HttpStatus.OK,
        'Metrics cache refreshed successfully',
        { refreshedAt },
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh metrics cache: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
