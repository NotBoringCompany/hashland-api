import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrillingCycleService } from './drilling-cycle.service';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from './schemas/drilling-cycle.schema';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { DrillingCycleController } from './drilling-cycle.controller';
import { DrillingSessionModule } from './drilling-session.module';
import { OperatorModule } from 'src/operators/operator.module';
import { DrillModule } from './drill.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import { PoolModule } from 'src/pools/pool.module';
import { RedisModule } from 'src/common/redis.module';
import { DrillingGatewayModule } from 'src/gateway/drilling.gateway.module';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import {
  DrillingSession,
  DrillingSessionSchema,
} from './schemas/drilling-session.schema';
import { DrillingCycleQueue } from './drilling-cycle.queue';

@Module({
  imports: [
    ConfigModule, // Load environment variables
    DrillingSessionModule, // Import DrillingSessionModule
    OperatorModule, // Import OperatorModule
    DrillModule, // Import DrillModule
    PoolOperatorModule, // Import PoolOperatorModule
    PoolModule, // Import PoolModule
    RedisModule, // Import RedisModule
    DrillingGatewayModule, // Import DrillingGatewayModule
    MongooseModule.forFeature([
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
      { name: DrillingSession.name, schema: DrillingSessionSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
    BullModule.registerQueue({ name: 'drilling-cycles' }), // Register Bull queue
  ],
  controllers: [DrillingCycleController],
  providers: [DrillingCycleService, DrillingCycleQueue],
  exports: [DrillingCycleService], // Export so other modules can use DrillingCycleService
})
export class DrillingCycleModule {}
