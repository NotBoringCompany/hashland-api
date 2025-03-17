import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { Operator } from 'src/operators/schemas/operator.schema';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectModel(Operator.name) private readonly operatorModel: Model<Operator>,
  ) {}

  /**
   * Fetches the leaderboard with pagination.
   */
  async getLeaderboard(
    page: number = 1,
    limit: number = 50,
  ): Promise<ApiResponse<{
    leaderboard: Array<{
      rank: number;
      username: string;
      earnedHASH: number;
    }>;
  }> | null> {
    // Page number must be a positive integer
    if (isNaN(page) || page < 1) {
      return new ApiResponse(
        400,
        '(getLeaderboard) Leaderboard pagination page value invalid.',
      );
    }

    // Max limit at 100
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return new ApiResponse(
        400,
        '(getLeaderboard) Leaderboard pagination limit value invalid.',
      );
    }

    try {
      const skip = (page - 1) * limit;
      // Fetch the `totalEarnedHASH` parameter from the Operator schema for `limit` amount of operators
      const leaderboard = await this.operatorModel
        .find(
          {},
          {
            username: 1,
            totalEarnedHASH: 1,
          },
        )
        .sort({ totalEarnedHASH: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Map the leaderboard to include the rank
      const rankedLeaderboard = leaderboard.map((operator, index) => ({
        rank: index + 1 + skip,
        username: operator.username,
        earnedHASH: operator.totalEarnedHASH,
      }));

      return new ApiResponse(
        200,
        `(getLeaderboard) Successfully fetched leaderboard.`,
        { leaderboard: rankedLeaderboard },
      );
    } catch (err: any) {
      this.logger.error(
        `(getLeaderboard) Error fetching leaderboard: ${err.message}`,
      );
      return new ApiResponse(500, '(getLeaderboard) Internal server error');
    }
  }
}
