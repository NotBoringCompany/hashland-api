import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import {
  OperatorWallet,
  OperatorWalletSchema,
} from './schemas/operator-wallet.schema';
import { OperatorService } from './operator.service';
import { PoolModule } from 'src/pools/pool.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import {
  DrillingSession,
  DrillingSessionSchema,
} from 'src/drills/schemas/drilling-session.schema';
import { OperatorWalletModule } from './operator-wallet.module';
import { ConfigModule } from '@nestjs/config';
import { Drill, DrillSchema } from 'src/drills/schemas/drill.schema';
import { DrillModule } from 'src/drills/drill.module';
import { OperatorQueue } from './operator.queue';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
      { name: DrillingSession.name, schema: DrillingSessionSchema },
      { name: Drill.name, schema: DrillSchema },
    ]),
    BullModule.registerQueue({
      name: 'operator-queue',
    }),
    OperatorWalletModule,
    PoolModule,
    PoolOperatorModule,
    DrillModule,
  ],
  controllers: [], // Expose API endpoints
  providers: [OperatorService, OperatorQueue], // Business logic for Operators
  exports: [MongooseModule, OperatorService], // Allow usage in other modules
})
export class OperatorModule {}
