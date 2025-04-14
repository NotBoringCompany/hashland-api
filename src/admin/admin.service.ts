import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from 'src/common/redis.service';
import { DrillingCycleRewardShare } from 'src/drills/schemas/drilling-crs.schema';
import { DrillingCycle } from 'src/drills/schemas/drilling-cycle.schema';
import { DrillingSession } from 'src/drills/schemas/drilling-session.schema';
import { HASHReserve } from 'src/hash-reserve/schemas/hash-reserve.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';
import { Pool } from 'src/pools/schemas/pool.schema';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(DrillingCycle.name)
    private drillingCycleModel: Model<DrillingCycle>,
    @InjectModel(DrillingCycleRewardShare.name)
    private drillingCycleRewardShareModel: Model<DrillingCycleRewardShare>,
    @InjectModel(HASHReserve.name) private hashReserveModel: Model<HASHReserve>,
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(Pool.name) private poolModel: Model<Pool>,
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Resets all cycle-related data, such as DrillingCycles, DrillingCycleRewardShares, HashReserve, all operators' totalEarnedHASH, and so on.
   *
   * WARNING: @Devs Please do NOT call this function willingly; only do this when absolutely necessary.
   */
  async resetCycleData(): Promise<void> {
    try {
      // Delete the following:
      // 1. DrillingCycles
      // 2. DrillingCycleRewardShares
      // 3. DrillingSessions
      await this.drillingCycleModel.deleteMany({}).then((data) => {
        this.logger.log(
          `(resetCycleData) Deleted ${data.deletedCount} drilling cycles`,
        );
      });
      await this.drillingCycleRewardShareModel.deleteMany({}).then((data) => {
        this.logger.log(
          `(resetCycleData) Deleted ${data.deletedCount} drilling cycle reward shares`,
        );
      });
      await this.drillingSessionModel.deleteMany({}).then((data) => {
        this.logger.log(
          `(resetCycleData) Deleted ${data.deletedCount} drilling sessions`,
        );
      });

      // Update the following:
      // 1. All of the operators' totalEarnedHASH to 0
      // 2. All of the pools' `totalRewards` to 0
      // 3. All of the pool operators' `totalRewards` to 0
      // 4. The HASH reserve's `totalHash` to 0
      await this.operatorModel
        .updateMany({}, { $set: { totalEarnedHASH: 0 } })
        .then((data) => {
          this.logger.log(
            `(resetCycleData) Updated ${data.modifiedCount} operators' totalEarnedHASH to 0`,
          );
        });
      await this.poolModel
        .updateMany({}, { $set: { totalRewards: 0 } })
        .then((data) => {
          this.logger.log(
            `(resetCycleData) Updated ${data.modifiedCount} pools' totalRewards to 0`,
          );
        });
      await this.poolOperatorModel
        .updateMany({}, { $set: { totalRewards: 0 } })
        .then((data) => {
          this.logger.log(
            `(resetCycleData) Updated ${data.modifiedCount} pool operators' totalRewards to 0`,
          );
        });
      await this.hashReserveModel
        .updateMany({}, { $set: { totalHASH: 0 } })
        .then((data) => {
          this.logger.log(
            `(resetCycleData) Updated ${data.modifiedCount} hash reserves' totalHash to 0`,
          );
        });

      // Flush all Redis keys
      await this.redisService.flushAll().then((data) => {
        this.logger.log(`(resetCycleData) Flushed all Redis keys: ${data}`);
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        `(resetCycleData) Error resetting cycle data: ${err.message}`,
      );
    }
  }
}
