import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PoolOperator } from './schemas/pool-operator.schema';
import { Model, Types } from 'mongoose';
import { Pool } from './schemas/pool.schema';
import { ApiResponse } from 'src/common/dto/response.dto';
import { PoolService } from './pool.service';
import { MixpanelService } from 'src/mixpanel/mixpanel.service';
import { EVENT_CONSTANTS } from 'src/common/constants/mixpanel.constants';

@Injectable()
export class PoolOperatorService {
  constructor(
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    @InjectModel(Pool.name) private readonly poolModel: Model<Pool>,
    private readonly poolService: PoolService,
    private readonly mixpanelService: MixpanelService,
  ) {}

  /**
   * Creates a `PoolOperator` instance, linking an operator to a pool.
   *
   * This is called when an operator joins a pool.
   */
  async createPoolOperator(
    operatorId: Types.ObjectId,
    poolId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      // Validate inputs to prevent null values
      if (!operatorId || !poolId) {
        return new ApiResponse<null>(
          400,
          `(createPoolOperator) Invalid operatorId or poolId.`,
        );
      }

      // ✅ Step 1: Fetch pool details + check if operator is already in a pool
      const [operatorInPool, pool] = await Promise.all([
        this.poolOperatorModel.exists({ operator: operatorId }),
        this.poolModel.findOne({ _id: poolId }, { maxOperators: 1 }).lean(),
      ]);

      if (operatorInPool) {
        return new ApiResponse<null>(
          400,
          `(createPoolOperator) Operator is already in a pool.`,
        );
      }

      if (!pool) {
        return new ApiResponse<null>(
          404,
          `(createPoolOperator) Pool not found.`,
        );
      }

      // ✅ Step 2: Check if the pool is full
      const poolOperatorCount = await this.poolOperatorModel.countDocuments({
        pool: poolId,
      });
      if (poolOperatorCount >= pool.maxOperators) {
        return new ApiResponse<null>(400, `(joinPool) Pool is full.`);
      }

      // TO DO IN THE FUTURE:
      // Ensure that the pool prerequisites are met before joining.

      // ✅ Step 3: Insert operator into the pool using direct creation to avoid field name issues
      try {
        await this.poolOperatorModel.create({
          operator: operatorId,
          pool: poolId,
        });
      } catch (createError) {
        if (createError.code === 11000) {
          // Duplicate key error
          return new ApiResponse<null>(
            400,
            `(createPoolOperator) Operator already joined this pool.`,
          );
        }
        throw createError;
      }

      // ✅ Step 4: Update pool's estimated efficiency
      try {
        await this.poolService.updatePoolEstimatedEff(poolId);
      } catch (effError) {
        // Log but don't fail the operation if efficiency update fails
        console.error(
          `Error updating pool efficiency after join: ${effError.message}`,
        );
      }

      this.mixpanelService.track(EVENT_CONSTANTS.POOL_JOIN, {
        distinct_id: operatorId,
        pool,
      });

      return new ApiResponse<null>(
        200,
        `(createPoolOperator) Operator successfully joined pool.`,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(createPoolOperator) Error joining pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Deletes a `PoolOperator` instance, unlinking an operator from a pool.
   *
   * This is called when an operator leaves a pool.
   */
  async removePoolOperator(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      // TO DO: Pool prerequisites check (e.g. if tgChannelId exists, the user needs to leave the channel first).

      // Get pool ID before removing the operator (needed for updating efficiency)
      const poolOperator = await this.poolOperatorModel.findOne(
        { operator: operatorId },
        { pool: 1 },
      );

      if (!poolOperator) {
        return new ApiResponse<null>(
          404,
          `(removeOperatorFromPool) Operator is not in any pool.`,
        );
      }

      const poolId = poolOperator.pool;

      // Remove operator from pool
      await this.poolOperatorModel.findOneAndDelete({ operator: operatorId });

      // Update pool's estimated efficiency
      try {
        await this.poolService.updatePoolEstimatedEff(poolId);
      } catch (effError) {
        // Log but don't fail the operation if efficiency update fails
        console.error(
          `Error updating pool efficiency after leave: ${effError.message}`,
        );
      }

      this.mixpanelService.track(EVENT_CONSTANTS.POOL_LEAVE, {
        distinct_id: operatorId,
        poolId,
      });

      return new ApiResponse<null>(
        200,
        `(removeOperatorFromPool) Operator successfully removed from pool.`,
      );
    } catch (err: any) {
      throw new Error(
        `(removeOperatorFromPool) Error removing operator from pool: ${err.message}`,
      );
    }
  }
}
