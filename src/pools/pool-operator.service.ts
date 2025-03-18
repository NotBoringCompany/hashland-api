import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PoolOperator } from './schemas/pool-operator.schema';
import { Model, Types } from 'mongoose';
import { Pool } from './schemas/pool.schema';
import { ApiResponse } from 'src/common/dto/response.dto';

@Injectable()
export class PoolOperatorService {
  constructor(
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    @InjectModel(Pool.name) private readonly poolModel: Model<Pool>,
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
      // ✅ Step 1: Fetch pool details + check if operator is already in a pool
      const [operatorInPool, pool] = await Promise.all([
        this.poolOperatorModel.exists({ operatorId }),
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
        poolId,
      });
      if (poolOperatorCount >= pool.maxOperators) {
        return new ApiResponse<null>(400, `(joinPool) Pool is full.`);
      }

      // TO DO IN THE FUTURE:
      // Ensure that the pool prerequisites are met before joining.

      // ✅ Step 3: Insert operator into the pool **atomically** (prevent race conditions)
      const result = await this.poolOperatorModel.updateOne(
        { operatorId }, // Ensure operatorId is unique
        { $setOnInsert: { operatorId, poolId } }, // Insert only if it doesn't exist
        { upsert: true }, // Insert if not exists
      );

      if (result.upsertedCount === 0) {
        return new ApiResponse<null>(
          400,
          `(createPoolOperator) Operator already joined this pool.`,
        );
      }

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

      // NOTE: Because operators can only be in one pool at a time, we can just delete the entry if found.
      await this.poolOperatorModel.findOneAndDelete({ operatorId });

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
