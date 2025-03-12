import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from 'src/common/database.module';
import { ConfigModule } from '@nestjs/config';
import { PoolModule } from './pools/pool.module';
import { BullQueueModule } from './common/bull-queue.module';
import { RedisModule } from './common/redis.module';
import { ShopDrillModule } from './shops/shop-drill.module';
import { OperatorModule } from './operators/operator.module';
import { AuthModule } from './auth/auth.module';
import { OperatorWalletModule } from './operators/operator-wallet.module';
import { DrillingGatewayModule } from './gateway/drilling.gateway.module';
import { DrillingCycleModule } from './drills/drilling-cycle.module';
import { ShopItemModule } from './shops/shop-item.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available throughout the application
      envFilePath: '.env', // Load environment variables from .env file
    }),
    DatabaseModule,
    RedisModule,
    BullQueueModule,
    PoolModule,
    ShopDrillModule,
    OperatorModule,
    OperatorWalletModule,
    AuthModule,
    DrillingGatewayModule,
    DrillingCycleModule,
    ShopItemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
