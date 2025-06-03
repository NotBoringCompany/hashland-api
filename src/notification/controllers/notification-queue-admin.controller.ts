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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { AdminGuard } from 'src/auth/admin/admin.guard';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import { NotificationQueueMonitorService } from '../services/notification-queue-monitor.service';

/**
 * Admin controller for notification queue management and monitoring
 */
@ApiTags('Admin Notification Queue')
@Controller('admin/notification-queue')
@UseGuards(JwtAuthGuard, AdminGuard)
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    try {
      const [basicStats, metrics, performance] = await Promise.all([
        this.dispatcherService.getQueueStats(),
        this.monitorService.getQueueMetrics(),
        this.monitorService.getJobPerformance(),
      ]);

      this.logger.log('Queue statistics retrieved');
      return {
        basicStats,
        metrics,
        performance,
      };
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue health status retrieved successfully',
  })
  async getQueueHealth() {
    try {
      const health = await this.monitorService.getQueueHealth();
      this.logger.log(`Queue health check: ${health.status}`);
      return health;
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs retrieved successfully',
  })
  async getJobsByStatus(
    @Param('status')
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('start', new ParseIntPipe({ optional: true })) start = 0,
    @Query('end', new ParseIntPipe({ optional: true })) end = 50,
  ) {
    try {
      const jobs = await this.dispatcherService.getJobsByStatus(
        status,
        start,
        end,
      );
      this.logger.log(`Retrieved ${jobs.length} ${status} jobs`);
      return { status, jobs, count: jobs.length };
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Failed jobs retrieved successfully',
  })
  async getFailedJobs(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    try {
      const failedJobs = await this.monitorService.getFailedJobs(limit);
      this.logger.log(`Retrieved ${failedJobs.length} failed jobs`);
      return { failedJobs, count: failedJobs.length };
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getJobDetails(@Param('jobId') jobId: string) {
    try {
      const job = await this.dispatcherService.getJob(jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      this.logger.log(`Retrieved details for job ${jobId}`);
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      };
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
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retry a specific failed job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to retry',
    example: '12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job retry initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async retryJob(@Param('jobId') jobId: string) {
    try {
      await this.dispatcherService.retryJob(jobId);
      this.logger.log(`Initiated retry for job ${jobId}`);
      return { message: `Job ${jobId} retry initiated` };
    } catch (error) {
      this.logger.error(
        `Failed to retry job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Pause the notification queue
   */
  @Post('pause')
  @ApiOperation({
    summary: 'Pause notification queue',
    description: 'Pause the notification queue to stop processing jobs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue paused successfully',
  })
  async pauseQueue() {
    try {
      await this.dispatcherService.pauseQueue();
      this.logger.log('Notification queue paused');
      return { message: 'Notification queue paused successfully' };
    } catch (error) {
      this.logger.error(`Failed to pause queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resume the notification queue
   */
  @Post('resume')
  @ApiOperation({
    summary: 'Resume notification queue',
    description: 'Resume the notification queue to continue processing jobs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue resumed successfully',
  })
  async resumeQueue() {
    try {
      await this.dispatcherService.resumeQueue();
      this.logger.log('Notification queue resumed');
      return { message: 'Notification queue resumed successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to resume queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean completed jobs
   */
  @Delete('jobs/completed')
  @ApiOperation({
    summary: 'Clean completed jobs',
    description: 'Remove old completed jobs from the queue',
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    type: Number,
    description: 'Maximum age in milliseconds (default: 24 hours)',
    example: 86400000,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Completed jobs cleaned successfully',
  })
  async cleanCompletedJobs(
    @Query('maxAge', new ParseIntPipe({ optional: true }))
    maxAge = 24 * 60 * 60 * 1000, // 24 hours default
  ) {
    try {
      const removedCount =
        await this.dispatcherService.cleanCompletedJobs(maxAge);
      this.logger.log(`Cleaned ${removedCount} completed jobs`);
      return {
        message: `Cleaned ${removedCount} completed jobs`,
        removedCount,
        maxAge,
      };
    } catch (error) {
      this.logger.error(
        `Failed to clean completed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean failed jobs
   */
  @Delete('jobs/failed')
  @ApiOperation({
    summary: 'Clean failed jobs',
    description: 'Remove old failed jobs from the queue',
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    type: Number,
    description: 'Maximum age in milliseconds (default: 7 days)',
    example: 604800000,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Failed jobs cleaned successfully',
  })
  async cleanFailedJobs(
    @Query('maxAge', new ParseIntPipe({ optional: true }))
    maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days default
  ) {
    try {
      const removedCount = await this.dispatcherService.cleanFailedJobs(maxAge);
      this.logger.log(`Cleaned ${removedCount} failed jobs`);
      return {
        message: `Cleaned ${removedCount} failed jobs`,
        removedCount,
        maxAge,
      };
    } catch (error) {
      this.logger.error(
        `Failed to clean failed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get cached metrics (fast response)
   */
  @Get('metrics/cached')
  @ApiOperation({
    summary: 'Get cached queue metrics',
    description: 'Retrieve cached queue metrics for fast response',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cached metrics retrieved successfully',
  })
  async getCachedMetrics() {
    try {
      const [metrics, performance] = await Promise.all([
        this.monitorService.getCachedMetrics(),
        this.monitorService.getCachedPerformance(),
      ]);

      return {
        metrics: metrics || 'No cached data available',
        performance: performance || 'No cached data available',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cached metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Force refresh metrics cache
   */
  @Post('metrics/refresh')
  @ApiOperation({
    summary: 'Refresh metrics cache',
    description: 'Force refresh of queue metrics cache',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics cache refreshed successfully',
  })
  async refreshMetricsCache() {
    try {
      const [metrics, performance] = await Promise.all([
        this.monitorService.getQueueMetrics(),
        this.monitorService.getJobPerformance(),
      ]);

      this.logger.log('Metrics cache refreshed');
      return {
        message: 'Metrics cache refreshed successfully',
        metrics,
        performance,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh metrics cache: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
