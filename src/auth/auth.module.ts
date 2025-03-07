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

@Module({
  imports: [
    ConfigModule,
    OperatorModule,
    PoolOperatorModule,
    PoolModule,
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
    ]),
  ],
  controllers: [TelegramAuthController, JwtAuthController],
  providers: [TelegramAuthService, JwtStrategy, OperatorService],
  exports: [TelegramAuthService, JwtStrategy, JwtModule],
})
export class AuthModule {}
