import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from 'src/common/database.service';
import { BullQueueService } from './common/bull-queue.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
    private readonly bullQueueService: BullQueueService,
  ) {}

  /**
   * GET `/` - Returns "Hello World!"
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * GET `/health` - Returns MongoDB connection pool status
   */
  @Get('health')
  checkDatabaseHealth() {
    return this.databaseService.getPoolStatus();
  }

  /**
   * GET `/queue-status` - Health check API for Bull queue.
   */
  @Get('/queue-status')
  async getQueueStatus() {
    return this.bullQueueService.getQueueStatus();
  }
}
