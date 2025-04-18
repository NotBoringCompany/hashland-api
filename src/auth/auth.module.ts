import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthController } from './telegram-auth.controller';
import { Operator, OperatorSchema } from '../operators/schemas/operator.schema';
import { JwtStrategy } from './jwt/jwt.strategy';
import { OperatorModule } from 'src/operators/operator.module';
import { OperatorService } from 'src/operators/operator.service';
import { JwtAuthController } from './jwt-auth.controller';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';
import { PoolModule } from 'src/pools/pool.module';
import { OperatorWalletModule } from 'src/operators/operator-wallet.module';
import { DrillModule } from 'src/drills/drill.module';
import { WalletAuthService } from './wallet-auth.service';
import { WalletAuthController } from './wallet-auth.controller';
import {
  OperatorWallet,
  OperatorWalletSchema,
} from 'src/operators/schemas/operator-wallet.schema';
import { MixpanelModule } from 'src/mixpanel/mixpanel.module';
import { AdminGuard } from './admin/admin.guard';

@Module({
  imports: [
    ConfigModule,
    OperatorModule,
    OperatorWalletModule,
    PoolOperatorModule,
    PoolModule,
    DrillModule,
    MixpanelModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        secret: process.env.JWT_SECRET!,
        signOptions: {
          expiresIn: process.env.JWT_EXPIRATION || '24h',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: OperatorWallet.name, schema: OperatorWalletSchema },
    ]),
  ],
  controllers: [
    TelegramAuthController,
    JwtAuthController,
    WalletAuthController,
  ],
  providers: [
    TelegramAuthService,
    JwtStrategy,
    OperatorService,
    WalletAuthService,
    AdminGuard,
  ],
  exports: [
    TelegramAuthService,
    WalletAuthService,
    JwtStrategy,
    JwtModule,
    AdminGuard,
  ],
})
export class AuthModule {}
