import { Controller, Get, Post, Body } from '@nestjs/common';
import { DrillingCycleService } from './drilling-cycle.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

@Controller('drilling-cycles')
export class DrillingCycleController {
  constructor(private readonly drillingCycleService: DrillingCycleService) {}

  /**
   * Returns the current drilling cycle status.
   */
  @Get('status')
  getCycleStatus() {
    return {
      cycleEnabled: GAME_CONSTANTS.CYCLES.ENABLED,
    };
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
