import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pool } from './schemas/pool.schema';
import { ApiResponse } from 'src/common/dto/response.dto';

@Injectable()
export class PoolService {
  constructor(@InjectModel(Pool.name) private poolModel: Model<Pool>) {}

  // /**
  //  * Checks if the operator has met the pool prerequisites before joining.
  //  */
  // checkPoolPrequisites(
  //   prerequisites:
  // ) {

  // }

  /**
   * Creates a new pool. Bypasses prerequisites and costs. Admin only.
   */
  async createPoolAdmin(
    // the operator's database ID
    leaderId: string | null,
    // the name of the pool
    name: string,
    // the maximum number of operators allowed in the pool
    maxOperators?: number | null,
  ): Promise<
    ApiResponse<{
      poolId: string;
    }>
  > {
    try {
      const pool = await this.poolModel.create({
        leaderId: leaderId ? new Types.ObjectId(leaderId) : null,
        name,
        maxOperators,
        // default reward system
        rewardSystem: {
          extractorOperator: 48.0,
          leader: 4.0,
          activePoolOperators: 48.0,
        },
        // anyone can join
        joinPrerequisites: null,
      });

      return new ApiResponse<{ poolId: string }>(
        200,
        `(createPoolAdmin) Pool created.`,
        {
          poolId: pool._id.toString(),
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(createPoolAdmin) Error creating pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Fetch all pools. Optional projection to filter out fields.
   */
  async getAllPools(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ pools: Partial<Pool[]> }>> {
    try {
      const pools = await this.poolModel.find().select(projection).lean();

      return new ApiResponse<{ pools: Partial<Pool[]> }>(
        200,
        `(getAllPools) Fetched all pools.`,
        { pools },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getAllPools) Error fetching pools: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Get a pool by its ID.
   */
  async getPoolById(
    poolId: string,
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ pool: Pool | null }>> {
    try {
      const pool = await this.poolModel
        .findById(poolId)
        .select(projection)
        .lean();

      if (!pool) {
        throw new NotFoundException(
          new ApiResponse<null>(
            404,
            `(getPoolById) Pool with ID ${poolId} not found`,
          ),
        );
      }

      return new ApiResponse<{ pool: Pool | null }>(
        200,
        `(getPoolById) Fetched pool with ID ${poolId}.`,
        { pool },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getPoolById) Error fetching pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Update pool settings (e.g., maxOperators, joinPrerequisites).
   */
  async updatePool(poolId: string, updates: Partial<Pool>) {
    return this.poolModel.findByIdAndUpdate(poolId, updates, { new: true });
  }

  /**
   * Fetches one random public pool ID for new operators to join.
   *
   * @returns The ID of the pool to join
   */
  fetchRandomPublicPoolId(): string {
    // get the pool ID from the pool number.
    // hardcoding this reduces query time compared to fetching from the database.
    const poolIds: Array<{ poolNumber: number; poolId: string }> = [
      {
        poolNumber: 1,
        poolId: '67c59119e13cd025d70558f8',
      },
      {
        poolNumber: 2,
        poolId: '67c5913d38219727f71abcc9',
      },
      {
        poolNumber: 3,
        poolId: '67c59160bcc83377ab6e9201',
      },
    ];

    // randomize which pool to fetch
    return poolIds[Math.floor(Math.random() * poolIds.length)].poolId;
  }
}
