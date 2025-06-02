import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import {
  BidQueueJobDto,
  QueuePriority,
  QueueMetricsDto,
} from '../dto/queue.dto';
import { QUEUE_NAMES, JOB_TYPES, getQueueConfig } from '../config/queue.config';
import { BidType } from '../schemas/bid.schema';

/**
 * Service for managing bid processing queue
 */
@Injectable()
export class BidQueueService {
  private readonly logger = new Logger(BidQueueService.name);
  private readonly config = getQueueConfig();

  constructor(
    @InjectQueue(QUEUE_NAMES.BID_PROCESSING) private bidQueue: Queue,
  ) {}

  /**
   * Add bid to processing queue
   */
  async addBidToQueue(
    auctionId: string,
    bidderId: string,
    amount: number,
    bidType: BidType = BidType.REGULAR,
    metadata?: any,
  ): Promise<Job<BidQueueJobDto>> {
    try {
      const priority = this.calculatePriority(bidType, amount, auctionId);
      const jobData: BidQueueJobDto = {
        auctionId,
        bidderId,
        amount,
        bidType,
        priority,
        source: metadata?.source || 'api',
        clientIp: metadata?.clientIp,
        userAgent: metadata?.userAgent,
        socketId: metadata?.socketId,
        timestamp: new Date().toISOString(),
      };

      const job = await this.bidQueue.add(JOB_TYPES.PROCESS_BID, jobData, {
        priority,
        delay: this.calculateDelay(priority),
        attempts: this.config.processing.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.config.processing.retryDelay,
        },
        removeOnComplete: this.config.bull.defaultJobOptions.removeOnComplete,
        removeOnFail: this.config.bull.defaultJobOptions.removeOnFail,
      });

      this.logger.log(
        `Bid added to queue: ${job.id} (auction: ${auctionId}, bidder: ${bidderId}, amount: ${amount}, priority: ${priority})`,
      );

      return job;
    } catch (error) {
      this.logger.error(`Error adding bid to queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate job priority based on bid type and auction status
   */
  private calculatePriority(
    bidType: BidType,
    amount: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _auctionId: string,
  ): QueuePriority {
    // Buy-now bids get highest priority
    if (bidType === BidType.BUY_NOW) {
      return QueuePriority.CRITICAL;
    }

    // High-value bids get higher priority
    if (amount >= 10000) {
      return QueuePriority.HIGH;
    }

    // TODO: Check if auction is ending soon (would need auction data)
    // For now, default to medium priority
    return QueuePriority.MEDIUM;
  }

  /**
   * Calculate processing delay based on priority
   */
  private calculateDelay(priority: QueuePriority): number {
    switch (priority) {
      case QueuePriority.CRITICAL:
        return 0; // Process immediately
      case QueuePriority.HIGH:
        return 100; // 100ms delay
      case QueuePriority.MEDIUM:
        return 500; // 500ms delay
      case QueuePriority.LOW:
        return 1000; // 1s delay
      default:
        return 500;
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetricsDto> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.bidQueue.getWaiting(),
        this.bidQueue.getActive(),
        this.bidQueue.getCompleted(),
        this.bidQueue.getFailed(),
      ]);

      // Calculate average processing time from recent completed jobs
      const recentCompleted = completed.slice(-100); // Last 100 jobs
      const avgProcessingTime =
        recentCompleted.length > 0
          ? recentCompleted.reduce((sum, job) => {
              const processingTime = job.finishedOn
                ? job.finishedOn - job.processedOn!
                : 0;
              return sum + processingTime;
            }, 0) / recentCompleted.length
          : 0;

      // Calculate throughput (jobs per minute)
      const oneMinuteAgo = Date.now() - 60000;
      const recentJobs = completed.filter(
        (job) => job.finishedOn && job.finishedOn > oneMinuteAgo,
      );
      const throughput = recentJobs.length;

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        averageProcessingTime: avgProcessingTime,
        throughput,
      };
    } catch (error) {
      this.logger.error(`Error getting queue metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.bidQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        data: job.data,
        progress: job.progress(),
        state: await job.getState(),
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        opts: job.opts,
      };
    } catch (error) {
      this.logger.error(`Error getting job status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    try {
      const job = await this.bidQueue.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      await job.retry();
      this.logger.log(`Job retried: ${jobId}`);
    } catch (error) {
      this.logger.error(`Error retrying job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove job from queue
   */
  async removeJob(jobId: string): Promise<void> {
    try {
      const job = await this.bidQueue.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      await job.remove();
      this.logger.log(`Job removed: ${jobId}`);
    } catch (error) {
      this.logger.error(`Error removing job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up completed and failed jobs
   */
  async cleanupJobs(olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoff = Date.now() - olderThan;

      // Clean completed jobs
      await this.bidQueue.clean(cutoff, 'completed');

      // Clean failed jobs
      await this.bidQueue.clean(cutoff, 'failed');

      this.logger.log(`Cleaned up jobs older than ${olderThan}ms`);
    } catch (error) {
      this.logger.error(`Error cleaning up jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pause queue processing
   */
  async pauseQueue(): Promise<void> {
    try {
      await this.bidQueue.pause();
      this.logger.log('Queue paused');
    } catch (error) {
      this.logger.error(`Error pausing queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume queue processing
   */
  async resumeQueue(): Promise<void> {
    try {
      await this.bidQueue.resume();
      this.logger.log('Queue resumed');
    } catch (error) {
      this.logger.error(`Error resuming queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<{
    isHealthy: boolean;
    metrics: QueueMetricsDto;
    issues: string[];
  }> {
    try {
      const metrics = await this.getQueueMetrics();
      const issues: string[] = [];

      // Check for potential issues
      if (metrics.waiting > 1000) {
        issues.push('High number of waiting jobs');
      }

      if (metrics.failed > metrics.completed * 0.1) {
        issues.push('High failure rate');
      }

      if (metrics.averageProcessingTime > 10000) {
        issues.push('Slow processing times');
      }

      const isHealthy = issues.length === 0;

      return {
        isHealthy,
        metrics,
        issues,
      };
    } catch (error) {
      this.logger.error(`Error checking queue health: ${error.message}`);
      return {
        isHealthy: false,
        metrics: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          averageProcessingTime: 0,
          throughput: 0,
        },
        issues: ['Unable to check queue health'],
      };
    }
  }
}
