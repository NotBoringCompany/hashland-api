import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/common/redis.service';

/**
 * Interface for queue metrics
 */
export interface QueueMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  waitingJobs: number;
  delayedJobs: number;
  successRate: number;
  averageProcessingTime: number;
  averageWaitTime: number;
  throughputPerMinute: number;
  lastUpdated: Date;
}

/**
 * Interface for job performance data
 */
export interface JobPerformanceData {
  jobType: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  lastHourThroughput: number;
  successRate: number;
}

/**
 * Service for monitoring notification queue performance and health
 */
@Injectable()
export class NotificationQueueMonitorService {
  private readonly logger = new Logger(NotificationQueueMonitorService.name);
  private readonly metricsKey = 'notification:queue:metrics';
  private readonly performanceKey = 'notification:queue:performance';

  constructor(
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get current queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.notificationQueue.getWaiting(),
        this.notificationQueue.getActive(),
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
        this.notificationQueue.getDelayed(),
      ]);

      const totalJobs =
        waiting.length +
        active.length +
        completed.length +
        failed.length +
        delayed.length;
      const successRate =
        totalJobs > 0
          ? (completed.length / (completed.length + failed.length)) * 100
          : 0;

      // Calculate average processing time from recent completed jobs
      const recentCompleted = completed.slice(-100);
      const averageProcessingTime =
        recentCompleted.length > 0
          ? recentCompleted.reduce((sum, job) => {
              const processingTime =
                (job.finishedOn || 0) - (job.processedOn || 0);
              return sum + processingTime;
            }, 0) / recentCompleted.length
          : 0;

      // Calculate average wait time
      const averageWaitTime =
        recentCompleted.length > 0
          ? recentCompleted.reduce((sum, job) => {
              const waitTime = (job.processedOn || 0) - (job.timestamp || 0);
              return sum + waitTime;
            }, 0) / recentCompleted.length
          : 0;

      // Calculate throughput (jobs per minute)
      const oneMinuteAgo = Date.now() - 60000;
      const recentlyCompleted = completed.filter(
        (job) => (job.finishedOn || 0) > oneMinuteAgo,
      );
      const throughputPerMinute = recentlyCompleted.length;

      const metrics: QueueMetrics = {
        totalJobs,
        completedJobs: completed.length,
        failedJobs: failed.length,
        activeJobs: active.length,
        waitingJobs: waiting.length,
        delayedJobs: delayed.length,
        successRate,
        averageProcessingTime,
        averageWaitTime,
        throughputPerMinute,
        lastUpdated: new Date(),
      };

      // Cache metrics in Redis
      await this.redisService.set(
        this.metricsKey,
        JSON.stringify(metrics),
        300, // 5 minutes TTL
      );

      return metrics;
    } catch (error) {
      this.logger.error(
        `Failed to get queue metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get job performance data by type
   */
  async getJobPerformance(): Promise<JobPerformanceData[]> {
    try {
      const [completed, failed] = await Promise.all([
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
      ]);

      const allJobs = [...completed, ...failed];
      const jobsByType = new Map<string, Job[]>();

      // Group jobs by type
      allJobs.forEach((job) => {
        const jobType = job.name || 'unknown';
        if (!jobsByType.has(jobType)) {
          jobsByType.set(jobType, []);
        }
        jobsByType.get(jobType)?.push(job);
      });

      const performanceData: JobPerformanceData[] = [];
      const oneHourAgo = Date.now() - 3600000;

      for (const [jobType, jobs] of jobsByType) {
        const completedJobs = jobs.filter(
          (job) => job.finishedOn && !job.failedReason,
        );
        const failedJobs = jobs.filter((job) => job.failedReason);

        const averageProcessingTime =
          completedJobs.length > 0
            ? completedJobs.reduce((sum, job) => {
                const processingTime =
                  (job.finishedOn || 0) - (job.processedOn || 0);
                return sum + processingTime;
              }, 0) / completedJobs.length
            : 0;

        const lastHourJobs = jobs.filter(
          (job) => (job.finishedOn || job.timestamp || 0) > oneHourAgo,
        );

        const successRate =
          jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0;

        performanceData.push({
          jobType,
          totalJobs: jobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          averageProcessingTime,
          lastHourThroughput: lastHourJobs.length,
          successRate,
        });
      }

      // Cache performance data
      await this.redisService.set(
        this.performanceKey,
        JSON.stringify(performanceData),
        300, // 5 minutes TTL
      );

      return performanceData;
    } catch (error) {
      this.logger.error(
        `Failed to get job performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get failed jobs with error details
   */
  async getFailedJobs(limit = 50): Promise<
    Array<{
      id: string;
      name: string;
      data: any;
      failedReason: string;
      failedOn: number;
      attemptsMade: number;
    }>
  > {
    try {
      const failedJobs = await this.notificationQueue.getFailed(0, limit - 1);

      return failedJobs.map((job) => ({
        id: job.id?.toString() || 'unknown',
        name: job.name || 'unknown',
        data: job.data,
        failedReason: job.failedReason || 'Unknown error',
        failedOn: job.failedReason ? job.finishedOn || 0 : 0,
        attemptsMade: job.attemptsMade || 0,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get failed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: QueueMetrics;
  }> {
    try {
      const metrics = await this.getQueueMetrics();
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Check for critical issues
      if (metrics.successRate < 90) {
        issues.push(`Low success rate: ${metrics.successRate.toFixed(1)}%`);
        status = 'critical';
      }

      if (metrics.waitingJobs > 1000) {
        issues.push(`High queue backlog: ${metrics.waitingJobs} waiting jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (metrics.averageProcessingTime > 30000) {
        // 30 seconds
        issues.push(
          `Slow processing: ${(metrics.averageProcessingTime / 1000).toFixed(1)}s average`,
        );
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (metrics.failedJobs > metrics.completedJobs * 0.1) {
        issues.push(`High failure rate: ${metrics.failedJobs} failed jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      // Check for warning issues
      if (status === 'healthy') {
        if (metrics.successRate < 95) {
          issues.push(
            `Moderate success rate: ${metrics.successRate.toFixed(1)}%`,
          );
          status = 'warning';
        }

        if (metrics.waitingJobs > 500) {
          issues.push(
            `Moderate queue backlog: ${metrics.waitingJobs} waiting jobs`,
          );
          status = 'warning';
        }

        if (metrics.averageProcessingTime > 10000) {
          // 10 seconds
          issues.push(
            `Moderate processing time: ${(metrics.averageProcessingTime / 1000).toFixed(1)}s average`,
          );
          status = 'warning';
        }
      }

      if (issues.length === 0) {
        issues.push('Queue is operating normally');
      }

      return { status, issues, metrics };
    } catch (error) {
      this.logger.error(
        `Failed to get queue health: ${error.message}`,
        error.stack,
      );
      return {
        status: 'critical',
        issues: [`Health check failed: ${error.message}`],
        metrics: {} as QueueMetrics,
      };
    }
  }

  /**
   * Clean old completed and failed jobs (runs every hour)
   */
  @Cron('0 * * * *') // Every hour
  async cleanOldJobs(): Promise<void> {
    try {
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const cutoffTime = Date.now() - maxAge;

      const [completed, failed] = await Promise.all([
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
      ]);

      let removedCount = 0;

      // Clean completed jobs older than 24 hours
      for (const job of completed) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          await job.remove();
          removedCount++;
        }
      }

      // Clean failed jobs older than 24 hours (keep fewer failed jobs)
      const failedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days for failed jobs
      for (const job of failed) {
        if (job.finishedOn && job.finishedOn < failedCutoff) {
          await job.remove();
          removedCount++;
        }
      }

      if (removedCount > 0) {
        this.logger.log(
          `Cleaned ${removedCount} old jobs from notification queue`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to clean old jobs: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Log queue metrics (runs every 5 minutes)
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async logQueueMetrics(): Promise<void> {
    try {
      const metrics = await this.getQueueMetrics();

      this.logger.log(
        `Queue Metrics - Total: ${metrics.totalJobs}, ` +
          `Active: ${metrics.activeJobs}, Waiting: ${metrics.waitingJobs}, ` +
          `Success Rate: ${metrics.successRate.toFixed(1)}%, ` +
          `Throughput: ${metrics.throughputPerMinute}/min, ` +
          `Avg Processing: ${(metrics.averageProcessingTime / 1000).toFixed(1)}s`,
      );

      // Log warning if metrics are concerning
      if (metrics.successRate < 95 || metrics.waitingJobs > 500) {
        this.logger.warn(
          `Queue performance concerns detected - ` +
            `Success Rate: ${metrics.successRate.toFixed(1)}%, ` +
            `Waiting Jobs: ${metrics.waitingJobs}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to log queue metrics: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get cached metrics from Redis
   */
  async getCachedMetrics(): Promise<QueueMetrics | null> {
    try {
      const cached = await this.redisService.get(this.metricsKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get cached metrics: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Get cached performance data from Redis
   */
  async getCachedPerformance(): Promise<JobPerformanceData[] | null> {
    try {
      const cached = await this.redisService.get(this.performanceKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get cached performance: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
