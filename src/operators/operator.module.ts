import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import {
  OperatorWallet,
  OperatorWalletSchema,
} from './schemas/operator-wallet.schema';
import { OperatorService } from './operator.service';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PoolModule } from 'src/pools/pool.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import {
  DrillingSession,
  DrillingSessionSchema,
} from 'src/drills/schemas/drilling-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
      { name: DrillingSession.name, schema: DrillingSessionSchema },
    ]),
    PoolModule,
    PoolOperatorModule,
  ],
  controllers: [WalletController], // Expose API endpoints
  providers: [OperatorService, WalletService], // Business logic for Operators
  exports: [MongooseModule, OperatorService, WalletService], // Allow usage in other modules
})
export class OperatorModule {}
