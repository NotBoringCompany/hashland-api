import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DrillingCycleService } from './drilling-cycle.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

@Injectable()
@Processor('drilling-cycles')
export class DrillingCycleQueue implements OnModuleInit {
  private readonly logger = new Logger(DrillingCycleQueue.name);
  private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000;

  constructor(
    private readonly drillingCycleService: DrillingCycleService,
    @InjectQueue('drilling-cycles') private readonly drillingCycleQueue: Queue, // ✅ Inject Bull Queue
  ) {}

  /**
   * Called when the module initializes. Ensures cycle tracking starts.
   */
  async onModuleInit() {
    await this.drillingCycleService.initializeCycleNumber();

    if (!GAME_CONSTANTS.CYCLES.ENABLED) {
      this.logger.warn(
        '🚨 (DrillingCycleQueue) Drilling Cycles are disabled. No cycles will be created.',
      );
      return;
    }

    // ✅ Start the recurring job if it doesn't already exist
    const jobs = await this.drillingCycleQueue.getRepeatableJobs();
    if (jobs.length === 0) {
      this.logger.log(
        `⏳ Starting Drilling Cycle job every ${this.cycleDuration / 1000} seconds.`,
      );
      await this.drillingCycleQueue.add(
        'new-drilling-cycle',
        {},
        { repeat: { every: this.cycleDuration } }, // ✅ Use cycleDuration here
      );
    } else {
      this.logger.log(`🔄 Drilling Cycle job already scheduled.`);
    }
  }

  /**
   * Handles new drilling cycle creation.
   */
  @Process('new-drilling-cycle')
  async handleNewDrillingCycle() {
    if (!GAME_CONSTANTS.CYCLES.ENABLED) {
      this.logger.warn(
        '🚨 (handleNewDrillingCycle) Drilling Cycle is disabled. Skipping this cycle.',
      );
      return;
    }

    this.logger.log(`⛏️ Processing new drilling cycle...`);
    await this.drillingCycleService.createDrillingCycle();
  }
}
