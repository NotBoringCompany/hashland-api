import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PoolOperator } from './schemas/pool-operator.schema';
import { Model, Types } from 'mongoose';
import { Pool } from './schemas/pool.schema';

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
  async createPoolOperator(operatorId: Types.ObjectId, poolId: Types.ObjectId) {
    try {
      // fetch the pool's `maxOperators` count.
      const pool = await this.poolModel
        .findOne({ _id: poolId })
        .select('maxOperators')
        .lean();

      if (!pool) {
        throw new Error(`(addOperatorToPool) Pool not found: ${poolId}`);
      }

      // check amount of operators in this pool. if it's full, throw an error.
      const poolOperatorCount = await this.poolOperatorModel.countDocuments({
        poolId,
      });

      if (poolOperatorCount >= pool.maxOperators) {
        throw new Error(
          `(addOperatorToPool) Pool is full. Max operators: ${pool.maxOperators}`,
        );
      }

      // create the pool operator entry
      await this.poolOperatorModel.create({
        operatorId,
        poolId,
      });
    } catch (err: any) {
      throw new Error(
        `(addOperatorToPool) Error adding operator to pool: ${err.message}`,
      );
    }
  }
}
