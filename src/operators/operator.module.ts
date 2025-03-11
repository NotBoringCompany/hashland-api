import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import { OperatorService } from './operator.service';
import { PoolModule } from 'src/pools/pool.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import { OperatorWalletModule } from './operator-wallet.module';
import { ConfigModule } from '@nestjs/config';
import { DrillModule } from 'src/drills/drill.module';
import { BullModule } from '@nestjs/bull';
import { OperatorQueue } from './operator.queue';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
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
