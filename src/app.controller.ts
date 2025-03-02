import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from 'common/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
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
}
