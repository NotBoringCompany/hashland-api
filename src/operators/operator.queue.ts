import {
  Processor,
  Process,
  InjectQueue,
  OnGlobalQueueStalled,
  OnGlobalQueueFailed,
} from '@nestjs/bull';
import { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OperatorService } from './operator.service';

@Injectable()
@Processor('operator-queue')
export class OperatorQueue implements OnModuleInit {
  private readonly logger = new Logger(OperatorQueue.name);
  private readonly oneHourInMs = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly operatorService: OperatorService,
    @InjectQueue('operator-queue') private readonly operatorQueue: Queue, // ✅ Inject Bull Queue
  ) {}

  /**
   * Called when the module initializes.
   */
  async onModuleInit() {
    // ✅ Schedule Cumulative Eff Update (Every 1 Hour)
    await this.ensureJobScheduled('update-cumulative-eff', this.oneHourInMs);
  }

  /**
   * Ensures a Bull job is scheduled, preventing duplicates.
   */
  private async ensureJobScheduled(jobName: string, intervalMs: number) {
    const existingJobs = await this.operatorQueue.getRepeatableJobs();
    if (!existingJobs.some((job) => job.name === jobName)) {
      await this.operatorQueue.add(
        jobName,
        {},
        {
          repeat: { every: intervalMs },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(
        `✅ (operatorQueue) Scheduled job: ${jobName} every ${intervalMs / 1000 / 60} minutes.`,
      );
    } else {
      this.logger.log(`🔄 (operatorQueue) Job already scheduled: ${jobName}.`);
    }
  }

  /**
   * Processes the cumulativeEff update job (now runs **every hour**).
   * This is a resource-intensive operation, so we set concurrency to 1.
   */
  @Process({
    name: 'update-cumulative-eff',
    concurrency: 1, // Limit to one concurrent job at a time
  })
  async handleCumulativeEffUpdate() {
    this.logger.log(
      `🔄 (update-cumulative-eff) Running scheduled cumulativeEff update...`,
    );
    try {
      await this.operatorService.updateCumulativeEff();
      this.logger.log(
        `✅ (update-cumulative-eff) Successfully updated cumulativeEff for all operators.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ (update-cumulative-eff) Error updating cumulativeEff: ${error.message}`,
      );
    }
  }

  /**
   * Handle stalled jobs in the queue.
   * This is a critical error that indicates something is wrong with the job processing.
   */
  @OnGlobalQueueStalled()
  onStalled(jobId: number) {
    this.logger.error(
      `🚨 CRITICAL: Operator Queue job ${jobId} has stalled! This may impact operator statistics.`,
    );
  }

  /**
   * Handle failed jobs in the queue.
   */
  @OnGlobalQueueFailed()
  onFailed(jobId: number, err: Error) {
    this.logger.error(
      `❌ Operator Queue job ${jobId} has failed: ${err.message}`,
    );
    // Log the stack trace for debugging
    this.logger.error(`Stack trace: ${err.stack}`);
  }
}
