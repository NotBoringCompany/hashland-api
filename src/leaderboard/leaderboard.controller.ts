import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { LeaderboardService } from './leaderboard.service';
import { Types } from 'mongoose';

@Controller('leaderboard') // Base route: `/leaderboard`
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET `/`
   * ✅ Fetches a leaderboard with pagination.
   * Example: `?page=1&limit=10`
   */
  @Get()
  async getLeaderboard(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ApiResponse<{
    leaderboard: Array<{
      rank: number;
      username: string;
      earnedHASH: number;
    }>;
  }> | null> {
    return this.leaderboardService.getLeaderboard(page, limit);
  }

  /**
   * GET `/pool`
   * ✅ Fetches a leaderboard with pagination.
   * Example: `?poolId=123&page=1&limit=10`
   */
  @Get('pool')
  async getPoolLeaderboard(
    @Query('poolId') poolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ApiResponse<{
    leaderboard: Array<{
      rank: number;
      username: string;
      earnedHASH: number;
    }>;
  }> | null> {
    return this.leaderboardService.getPoolLeaderboard(
      new Types.ObjectId(poolId),
      page,
      limit,
    );
  }
}
