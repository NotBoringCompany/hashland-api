import {
  Processor,
  Process,
  InjectQueue,
  OnGlobalQueueStalled,
  OnGlobalQueueFailed,
} from '@nestjs/bull';
import { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DrillingCycleService } from './drilling-cycle.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { RedisService } from 'src/common/redis.service';

@Injectable()
@Processor('drilling-cycles')
export class DrillingCycleQueue implements OnModuleInit {
  private readonly logger = new Logger(DrillingCycleQueue.name);
  private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000;

  constructor(
    private readonly drillingCycleService: DrillingCycleService,
    private readonly redisService: RedisService,
    @InjectQueue('drilling-cycles') private readonly drillingCycleQueue: Queue, // ✅ Inject Bull Queue
  ) {}

  /**
   * Called when the module initializes. Ensures cycle tracking starts.
   */
  async onModuleInit() {
    try {
      // Initialize cycle number first
      await this.drillingCycleService.initializeCycleNumber();

      if (!GAME_CONSTANTS.CYCLES.ENABLED) {
        this.logger.warn(
          '🚨 (DrillingCycleQueue) Drilling Cycles are disabled. No cycles will be created.',
        );
        return;
      }

      // Get the latest cycle number
      const latestCycleNumber =
        (await this.redisService.get('drilling-cycle:current')) ?? '0';

      this.logger.debug(`
        (DrillingCycleQueue) Latest cycle number: ${latestCycleNumber}.
        `);

      // If the total number of cycles has been reached, disable the cycle
      if (
        parseInt(latestCycleNumber, 10) >= GAME_CONSTANTS.CYCLES.TOTAL_CYCLES
      ) {
        this.logger.warn(
          '🚨 (DrillingCycleQueue) Total number of cycles has been reached. Disabling cycles.',
        );
        GAME_CONSTANTS.CYCLES.ENABLED = false;

        // Return to prevent any further processing
        return;
      }

      // Clean up any existing recurring jobs first
      const existingJobs = await this.drillingCycleQueue.getRepeatableJobs();

      // Remove all existing repeatable jobs to prevent duplication
      for (const job of existingJobs) {
        this.logger.log(`🧹 Removing existing repeatable job: ${job.key}`);
        await this.drillingCycleQueue.removeRepeatableByKey(job.key);
      }

      // Now add a fresh repeatable job
      this.logger.log(
        `⏳ Starting Drilling Cycle job every ${this.cycleDuration / 1000} seconds.`,
      );

      await this.drillingCycleQueue.add(
        'new-drilling-cycle',
        {},
        {
          repeat: { every: this.cycleDuration },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for debugging
        },
      );

      this.logger.log(`✅ Drilling Cycle job scheduled successfully.`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to initialize drilling cycle queue: ${error.message}`,
      );
      this.logger.error(error.stack);

      // Retry initialization after a delay if critical
      setTimeout(() => {
        this.logger.log('🔄 Retrying drilling cycle queue initialization...');
        this.onModuleInit().catch((err) => {
          this.logger.error(`❌ Retry failed: ${err.message}`);
        });
      }, 5000); // 5 second delay
    }
  }

  /**
   * Handles the drilling cycle queue process:
   * 1. Ends the current cycle (select extractor, distribute rewards, process fuel).
   * 2. Starts a new cycle.
   */
  @Process({
    name: 'new-drilling-cycle',
    concurrency: 1, // Ensures only one cycle processing job at a time
  })
  async handleNewDrillingCycle() {
    if (!GAME_CONSTANTS.CYCLES.ENABLED) {
      this.logger.warn(
        '🚨 (handleNewDrillingCycle) Drilling Cycle is disabled. Skipping this cycle.',
      );
      return;
    }

    try {
      // ✅ Step 1: Get current cycle number **before creating a new one**
      const latestCycleNumberStr = await this.redisService.get(
        'drilling-cycle:current',
      );
      const latestCycleNumber = latestCycleNumberStr
        ? parseInt(latestCycleNumberStr, 10)
        : 0;

      // Always call endCurrentCycle unless it's cycle 0 (before the first ever cycle)
      if (latestCycleNumber > 0) {
        try {
          await this.drillingCycleService.endCurrentCycle(latestCycleNumber);
          this.logger.log(`✅ Successfully ended cycle #${latestCycleNumber}`);
        } catch (err) {
          this.logger.error(`❌ Error while ending cycle: ${err.message}`);
          throw new Error(`Failed to end current cycle: ${err.message}`);
        }
      }

      if (latestCycleNumber >= GAME_CONSTANTS.CYCLES.TOTAL_CYCLES) {
        this.logger.warn(
          '🚨 (handleNewDrillingCycle) Total number of cycles has been reached. Disabling cycles.',
        );
        GAME_CONSTANTS.CYCLES.ENABLED = false;

        return;
      }

      // ✅ Step 2: Start a new drilling cycle
      this.logger.log(`⛏️ Starting a new drilling cycle...`);
      await this.drillingCycleService.createDrillingCycle();
      this.logger.log(`✅ New drilling cycle started.`);
    } catch (error) {
      this.logger.error(`❌ Error in drilling cycle handler: ${error.message}`);
      // Rethrow the error to let Bull handle the retry logic
      throw error;
    }
  }

  /**
   * Handle stalled jobs in the queue.
   * This is a critical error that indicates something is wrong with the job processing.
   */
  @OnGlobalQueueStalled()
  onStalled(jobId: number) {
    this.logger.error(
      `🚨 CRITICAL: Drilling cycle job ${jobId} has stalled! This could affect game cycles.`,
    );
  }

  /**
   * Handle failed jobs in the queue.
   */
  @OnGlobalQueueFailed()
  onFailed(jobId: number, err: Error) {
    this.logger.error(
      `❌ Drilling cycle job ${jobId} has failed: ${err.message}`,
    );
    // Log the stack trace for debugging
    this.logger.error(`Stack trace: ${err.stack}`);
  }
}
