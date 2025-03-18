import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { LeaderboardService } from './leaderboard.service';
import { Types } from 'mongoose';
import {
  GetLeaderboardQueryDto,
  GetPoolLeaderboardQueryDto,
  LeaderboardEntryDto,
  LeaderboardResponseDto,
} from 'src/common/dto/leaderboard.dto';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @ApiOperation({
    summary: 'Get global leaderboard',
    description: 'Fetches a paginated global leaderboard sorted by HASH earned',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved leaderboard',
    type: LeaderboardResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid pagination parameters',
  })
  @Get()
  async getLeaderboard(
    @Query() query: GetLeaderboardQueryDto,
  ): Promise<AppApiResponse<{
    leaderboard: LeaderboardEntryDto[];
  }> | null> {
    return this.leaderboardService.getLeaderboard(query.page, query.limit);
  }

  @ApiOperation({
    summary: 'Get pool leaderboard',
    description:
      'Fetches a paginated leaderboard for a specific pool sorted by HASH earned',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pool leaderboard',
    type: LeaderboardResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid pagination parameters or pool ID',
  })
  @Get('pool')
  async getPoolLeaderboard(
    @Query() query: GetPoolLeaderboardQueryDto,
  ): Promise<AppApiResponse<{
    leaderboard: LeaderboardEntryDto[];
  }> | null> {
    return this.leaderboardService.getPoolLeaderboard(
      new Types.ObjectId(query.poolId),
      query.page,
      query.limit,
    );
  }
}
