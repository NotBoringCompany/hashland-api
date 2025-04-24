import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ConfigService } from '@nestjs/config';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resets the drilling cycle data.
   */
  @Post('reset-cycle-data')
  async resetCycleData(@Body('password') password: string) {
    if (this.configService.get('ADMIN_PASSWORD') !== password) {
      throw new UnauthorizedException(`
        (resetCycleData) Invalid password. Please provide the correct password to reset cycle data.
        `);
    }
    await this.adminService.resetCycleData();
  }
}
