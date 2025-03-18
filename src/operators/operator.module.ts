import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import { OperatorService } from './operator.service';
import { PoolModule } from 'src/pools/pool.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import { ConfigModule } from '@nestjs/config';
import { DrillModule } from 'src/drills/drill.module';
import { BullModule } from '@nestjs/bull';
import { OperatorQueue } from './operator.queue';
import { Drill, DrillSchema } from 'src/drills/schemas/drill.schema';
import {
  OperatorWallet,
  OperatorWalletSchema,
} from './schemas/operator-wallet.schema';
import { OperatorController } from './operator.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: Drill.name, schema: DrillSchema },
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
    ]),
    BullModule.registerQueue({
      name: 'operator-queue',
    }),
    PoolModule,
    PoolOperatorModule,
    DrillModule,
  ],
  controllers: [OperatorController], // Expose API endpoints
  providers: [OperatorService, OperatorQueue], // Business logic for Operators
  exports: [MongooseModule, OperatorService], // Allow usage in other modules
})
export class OperatorModule {}
