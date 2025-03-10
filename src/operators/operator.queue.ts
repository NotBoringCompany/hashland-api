import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OperatorService } from './operator.service';

@Injectable()
@Processor('operator-queue')
export class OperatorQueue implements OnModuleInit {
  private readonly logger = new Logger(OperatorQueue.name);
  private readonly sixHoursInMs = 6 * 60 * 60 * 1000; // 6 hours

  constructor(
    private readonly operatorService: OperatorService,
    @InjectQueue('operator-queue') private readonly operatorQueue: Queue, // ✅ Inject Bull Queue
  ) {}

  /**
   * Called when the module initializes. Ensures asset equity updates are scheduled.
   */
  async onModuleInit() {
    this.logger.log(
      `⏳ Ensuring operator asset equity update job is scheduled...`,
    );

    // ✅ Check if the job is already scheduled
    const existingJobs = await this.operatorQueue.getRepeatableJobs();
    if (!existingJobs.some((job) => job.name === 'update-asset-equity')) {
      await this.operatorQueue.add(
        'update-asset-equity',
        {},
        { repeat: { every: this.sixHoursInMs } }, // ✅ Runs every 6 hours
      );
      this.logger.log(`✅ Scheduled asset equity update every 6 hours.`);
    } else {
      this.logger.log(`🔄 Asset equity update job is already scheduled.`);
    }
  }

  /**
   * Processes the asset equity update job.
   */
  @Process('update-asset-equity')
  async handleAssetEquityUpdate() {
    this.logger.log(`🔄 Running scheduled asset equity update...`);
    try {
      await this.operatorService.updateWeightedAssetEquityRelatedData();
      this.logger.log(
        `✅ Successfully updated weighted asset equity & effMultiplier.`,
      );
    } catch (error) {
      this.logger.error(`❌ Error updating asset equity: ${error.message}`);
    }
  }
}
