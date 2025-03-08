import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from 'src/common/database.module';
import { ConfigModule } from '@nestjs/config';
import { PoolModule } from './pools/pool.module';
import { ShopDrillModule } from './shops/shop-drill.module';
import { BullQueueModule } from './common/bull-queue.module';
import { AuthModule } from './auth/auth.module';
import { WebSocketModule } from './websocket/websocket.module';
import { RedisModule } from './common/redis.module';
import { DrillingCycleModule } from './drills/drilling-cycle.module';
import { DrillingGatewayModule } from './gateway/drilling.gateway.module';

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
    DrillingCycleModule,
    AuthModule,
    WebSocketModule,
    DrillingGatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
