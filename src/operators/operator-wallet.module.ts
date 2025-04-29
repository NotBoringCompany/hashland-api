import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OperatorWallet,
  OperatorWalletSchema,
} from './schemas/operator-wallet.schema';
import { OperatorWalletController } from './operator-wallet.controller';
import { OperatorWalletService } from './operator-wallet.service';
import { RedisModule } from 'src/common/redis.module';
import { ConfigModule } from '@nestjs/config';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import { Drill, DrillSchema } from 'src/drills/schemas/drill.schema';
import { AlchemyModule } from 'src/alchemy/alchemy.module';
import { MixpanelModule } from 'src/mixpanel/mixpanel.module';
import { JwtTonProofService } from 'src/common/services/jwt-ton-proof.service';
import { OperatorModule } from './operator.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
      { name: Drill.name, schema: DrillSchema },
    ]),
    RedisModule,
    AlchemyModule,
    MixpanelModule,
    OperatorModule,
  ],
  controllers: [OperatorWalletController], // Expose API endpoints
  providers: [OperatorWalletService, JwtTonProofService], // Business logic for Operators
  exports: [MongooseModule, OperatorWalletService], // Allow usage in other modules
})
export class OperatorWalletModule {}
