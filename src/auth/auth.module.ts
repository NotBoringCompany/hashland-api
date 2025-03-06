import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthController } from './telegram-auth.controller';
import { JwtAuthController } from './jwt-auth.controller';
import { Operator, OperatorSchema } from '../operators/schemas/operator.schema';
import { JwtStrategy } from './jwt/jwt.strategy';
import { OperatorModule } from 'src/operators/operator.module';
import { OperatorService } from 'src/operators/operator.service';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';

@Module({
  imports: [
    ConfigModule,
    OperatorModule,
    PoolOperatorModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '24h'),
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
