import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminService } from './admin.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from 'src/drills/schemas/drilling-cycle.schema';
import {
  DrillingCycleRewardShare,
  DrillingCycleRewardShareSchema,
} from 'src/drills/schemas/drilling-crs.schema';
import {
  HASHReserve,
  HashReserveSchema,
} from 'src/hash-reserve/schemas/hash-reserve.schema';
import { Pool, PoolSchema } from 'src/pools/schemas/pool.schema';
import {
  PoolOperator,
  PoolOperatorSchema,
} from 'src/pools/schemas/pool-operator.schema';
import { RedisModule } from 'src/common/redis.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
      {
        name: DrillingCycleRewardShare.name,
        schema: DrillingCycleRewardShareSchema,
      },
      { name: HASHReserve.name, schema: HashReserveSchema },
      { name: Pool.name, schema: PoolSchema },
      { name: PoolOperator.name, schema: PoolOperatorSchema },
    ]),
    RedisModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
