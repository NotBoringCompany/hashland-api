import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Types } from 'mongoose';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationPriority } from '../types/notification.types';
import {
  NotificationJobData,
  BatchNotificationJobData,
  BroadcastNotificationJobData,
} from '../processors/notification.processor';

/**
 * Priority mapping for queue job priorities
 */
const PRIORITY_MAPPING = {
  [NotificationPriority.CRITICAL]: 10,
  [NotificationPriority.HIGH]: 7,
  [NotificationPriority.MEDIUM]: 5,
  [NotificationPriority.LOW]: 1,
};

/**
 * Service responsible for dispatching notifications through the queue system
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {}

  /**
   * Send a single notification via queue
   */
  async sendNotification(
    notification: CreateNotificationDto,
    templateId?: string,
    templateContext?: any,
    options?: {
      delay?: number;
      maxRetries?: number;
      priority?: NotificationPriority;
    },
  ): Promise<string> {
    try {
      const priority = options?.priority || notification.priority;
      const jobData: NotificationJobData = {
        notification,
        userId: notification.recipientId,
        templateId,
        templateContext,
        priority,
        maxRetries: options?.maxRetries || 3,
        delayMs: options?.delay,
      };

      const jobOptions = {
        priority: PRIORITY_MAPPING[priority],
        delay: options?.delay || 0,
        attempts: options?.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      };

      const job = await this.notificationQueue.add(
        'send-notification',
        jobData,
        jobOptions,
      );

      this.logger.log(
        `Queued notification for user ${notification.recipientId} with priority ${priority} (Job ID: ${job.id})`,
      );

      return job.id?.toString() || 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to queue notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send delayed notification
   */
  async sendDelayedNotification(
    notification: CreateNotificationDto,
    delayMs: number,
    templateId?: string,
    templateContext?: any,
    options?: {
      maxRetries?: number;
      priority?: NotificationPriority;
    },
  ): Promise<string> {
    try {
      const priority = options?.priority || notification.priority;
      const jobData: NotificationJobData = {
        notification,
        userId: notification.recipientId,
        templateId,
        templateContext,
        priority,
        maxRetries: options?.maxRetries || 3,
        delayMs,
      };

      const jobOptions = {
        priority: PRIORITY_MAPPING[priority],
        delay: delayMs,
        attempts: options?.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      };

      const job = await this.notificationQueue.add(
        'send-delayed-notification',
        jobData,
        jobOptions,
      );

      this.logger.log(
        `Queued delayed notification for user ${notification.recipientId} with ${delayMs}ms delay (Job ID: ${job.id})`,
      );

      return job.id?.toString() || 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to queue delayed notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(
    notifications: Array<{
      notification: CreateNotificationDto;
      userId: Types.ObjectId;
      templateId?: string;
      templateContext?: any;
    }>,
    options?: {
      batchId?: string;
      priority?: NotificationPriority;
      maxRetries?: number;
    },
  ): Promise<string> {
    try {
      const batchId =
        options?.batchId ||
        `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const priority = options?.priority || NotificationPriority.MEDIUM;

      const jobData: BatchNotificationJobData = {
        notifications,
        priority,
        batchId,
        maxRetries: options?.maxRetries || 3,
      };

      const jobOptions = {
        priority: PRIORITY_MAPPING[priority],
        attempts: options?.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 25,
      };

      const job = await this.notificationQueue.add(
        'send-batch-notifications',
        jobData,
        jobOptions,
      );

      this.logger.log(
        `Queued batch of ${notifications.length} notifications with ID ${batchId} (Job ID: ${job.id})`,
      );

      return job.id?.toString() || 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to queue batch notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send broadcast notification to multiple users
   */
  async sendBroadcastNotification(
    notification: CreateNotificationDto,
    userIds: Types.ObjectId[],
    templateId?: string,
    templateContext?: any,
    options?: {
      broadcastId?: string;
      batchSize?: number;
      priority?: NotificationPriority;
      maxRetries?: number;
    },
  ): Promise<string> {
    try {
      const broadcastId =
        options?.broadcastId ||
        `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const priority = options?.priority || notification.priority;

      const jobData: BroadcastNotificationJobData = {
        notification,
        userIds,
        templateId,
        templateContext,
        priority,
        broadcastId,
        batchSize: options?.batchSize || 100,
        maxRetries: options?.maxRetries || 3,
      };

      const jobOptions = {
        priority: PRIORITY_MAPPING[priority],
        attempts: options?.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 25,
        removeOnFail: 10,
      };

      const job = await this.notificationQueue.add(
        'send-broadcast-notification',
        jobData,
        jobOptions,
      );

      this.logger.log(
        `Queued broadcast notification to ${userIds.length} users with ID ${broadcastId} (Job ID: ${job.id})`,
      );

      return job.id?.toString() || 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to queue broadcast notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.notificationQueue.getWaiting(),
        this.notificationQueue.getActive(),
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
        this.notificationQueue.getDelayed(),
      ]);

      const isPaused = await this.notificationQueue.isPaused();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: isPaused,
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
   * Get jobs by status
   */
  async getJobsByStatus(
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start = 0,
    end = -1,
  ) {
    try {
      switch (status) {
        case 'waiting':
          return await this.notificationQueue.getWaiting(start, end);
        case 'active':
          return await this.notificationQueue.getActive(start, end);
        case 'completed':
          return await this.notificationQueue.getCompleted(start, end);
        case 'failed':
          return await this.notificationQueue.getFailed(start, end);
        case 'delayed':
          return await this.notificationQueue.getDelayed(start, end);
        default:
          throw new Error(`Invalid status: ${status}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get jobs by status ${status}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove completed jobs older than specified age
   */
  async cleanCompletedJobs(maxAge = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const completed = await this.notificationQueue.getCompleted();
      const cutoffTime = Date.now() - maxAge;
      let removedCount = 0;

      for (const job of completed) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          await job.remove();
          removedCount++;
        }
      }

      this.logger.log(`Cleaned ${removedCount} completed jobs`);
      return removedCount;
    } catch (error) {
      this.logger.error(
        `Failed to clean completed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove failed jobs older than specified age
   */
  async cleanFailedJobs(maxAge = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const failed = await this.notificationQueue.getFailed();
      const cutoffTime = Date.now() - maxAge;
      let removedCount = 0;

      for (const job of failed) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          await job.remove();
          removedCount++;
        }
      }

      this.logger.log(`Cleaned ${removedCount} failed jobs`);
      return removedCount;
    } catch (error) {
      this.logger.error(
        `Failed to clean failed jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    try {
      await this.notificationQueue.pause();
      this.logger.log('Notification queue paused');
    } catch (error) {
      this.logger.error(`Failed to pause queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    try {
      await this.notificationQueue.resume();
      this.logger.log('Notification queue resumed');
    } catch (error) {
      this.logger.error(
        `Failed to resume queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    try {
      return await this.notificationQueue.getJob(jobId);
    } catch (error) {
      this.logger.error(
        `Failed to get job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    try {
      const job = await this.notificationQueue.getJob(jobId);
      if (job) {
        await job.retry();
        this.logger.log(`Retrying job ${jobId}`);
      } else {
        throw new Error(`Job ${jobId} not found`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to retry job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
