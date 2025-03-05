import { Controller, Get, Post, Body } from '@nestjs/common';
import { DrillingCycleService } from './drilling-cycle.service';

@Controller('drilling-cycles')
export class DrillingCycleController {
  constructor(private readonly drillingCycleService: DrillingCycleService) {}

  /**
   * Returns the current drilling cycle status.
   */
  @Get('status')
  getCycleStatus() {
    return this.drillingCycleService.getCycleStatus();
  }

  /**
   * Fetches the latest drilling cycle number from Redis.
   */
  @Get('cycle-number')
  async getCurrentCycleNumber() {
    return this.drillingCycleService.getCurrentCycleNumber();
  }

  /**
   * Enables or disables the drilling cycle system.
   * Requires `ADMIN_PASSWORD` for security.
   */
  @Post('toggle')
  toggleCycles(@Body() body: { enabled: boolean; password: string }) {
    return this.drillingCycleService.toggleCycle(body.enabled, body.password);
  }
}
