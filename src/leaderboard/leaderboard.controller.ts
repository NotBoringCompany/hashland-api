import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard') // Base route: `/leaderboard`
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET `/`
   * ✅ Fetches a leaderboard with pagination.
   * Example: `/pools?page=1&limit=10`
   */
  @Get()
  async getAllPools(
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
}
