import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BullQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullQueueService.name);

  constructor(
    @InjectQueue('drilling-cycles') private drillingCycleQueue: Queue,
  ) {}

  /**
   * Called when the module is initialized.
   * Verifies that Bull is working and Redis is connected.
   */
  async onModuleInit() {
    try {
      await this.drillingCycleQueue.getJobCounts();
      this.logger.log('✅ Bull Queue "drilling-cycles" is available.');
    } catch (error) {
      this.logger.error('❌ Bull Queue initialization failed:', error);
    }
  }

  /**
   * Called when the module is destroyed (i.e., when the app shuts down).
   * Ensures Redis connection is gracefully handled.
   */
  async onModuleDestroy() {
    this.logger.log('🔌 Closing Bull Queue connections...');
    await this.drillingCycleQueue.close();
  }

  /**
   * Returns the current status of Bull/Redis queues.
   */
  async getQueueStatus() {
    try {
      const jobCounts = await this.drillingCycleQueue.getJobCounts();
      return {
        isConnected: '✅ Connected',
        waiting: jobCounts.waiting,
        active: jobCounts.active,
        failed: jobCounts.failed,
        completed: jobCounts.completed,
      };
    } catch (error) {
      return {
        isConnected: '❌ Not Connected',
        error: error.message,
      };
    }
  }
}
