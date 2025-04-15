import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { DrillService } from './drill.service';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';

@Controller('drills')
export class DrillController {
  constructor(private readonly drillService: DrillService) {}

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
