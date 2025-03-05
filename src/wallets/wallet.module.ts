import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { WalletService } from './services/wallet.services';
import { WalletConnectionService } from './services/wallet-connection-service';
import { WalletValidationService } from './services/wallet-validation-service';
import { WalletController } from './wallet.controller';
import { TelegramWalletStrategy } from './strategies/telegram-wallet-strategy';
import { WalletEncryptionUtil } from './utils/wallet-encryption';
import { WalletSignatureValidator } from './utils/wallet-signature-validator';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import {
  WalletConnectionEvent,
  WalletConnectionEventSchema,
} from './schemas/wallet.schema';
import { Operator, OperatorSchema } from '../operators/schemas/operator.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: WalletConnectionEvent.name, schema: WalletConnectionEventSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
    BullModule.registerQueue({
      name: 'wallet-events',
    }),
  ],
  controllers: [WalletController],
  providers: [
    {
      provide: TelegramWalletStrategy,
      useClass: TelegramWalletStrategy,
    },
    {
      provide: WalletConnectionService,
      useClass: WalletConnectionService,
    },
    WalletValidationService,
    WalletService,
    WalletEncryptionUtil,
    WalletSignatureValidator,
  ],
  exports: [
    WalletService,
    WalletConnectionService,
    WalletValidationService,
    TelegramWalletStrategy,
  ],
})
export class WalletModule {}
