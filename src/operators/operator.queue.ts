import { Processor, Process, InjectQueue } from '@nestjs/bull';
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
        { repeat: { every: intervalMs } },
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
   */
  @Process('update-cumulative-eff')
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
}
