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

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
    ]),
    RedisModule,
  ],
  controllers: [OperatorWalletController], // Expose API endpoints
  providers: [OperatorWalletService], // Business logic for Operators
  exports: [MongooseModule, OperatorWalletService], // Allow usage in other modules
})
export class OperatorWalletModule {}
