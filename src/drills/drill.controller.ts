import {
  Body,
  Controller,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { DrillService } from './drill.service';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { ConfigService } from '@nestjs/config';

@Controller('drills')
export class DrillController {
  constructor(
    private readonly drillService: DrillService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * * Creates a new drill for the operator. Admin-only.
   */
  @Post('admin-create')
  async createDrillAdmin(
    @Body('password') adminPassword: string,
    @Body('operatorId') operatorId: string,
    @Body('version') version: string,
    @Body('config') config: string,
    @Body('extractorAllowed') extractorAllowed: boolean,
    @Body('actualEff') actualEff: number,
  ) {
    if (adminPassword !== this.configService.get('ADMIN_PASSWORD')) {
      throw new UnauthorizedException(`
        (resetCycleData) Invalid password. Please provide the correct password to reset cycle data.
        `);
    }

    return this.drillService.createDrill(
      new Types.ObjectId(operatorId),
      version as DrillVersion,
      config as DrillConfig,
      extractorAllowed,
      actualEff,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('toggle-active')
  async toggleDrillActiveState(
    @Request() req,
    @Body('drillId') drillId: string,
    @Body('state') state: boolean,
  ) {
    const operatorId = new Types.ObjectId(req.user.operatorId);
    return this.drillService.toggleDrillActiveState(
      operatorId,
      new Types.ObjectId(drillId),
      state,
    );
  }
}
