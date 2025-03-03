import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from 'src/common/database.module';
import { ConfigModule } from '@nestjs/config';
import { PoolsModule } from './pools/pools.module';
import { ShopDrillsModule } from './shops/shop-drill.module';
import { BullQueueModule } from './common/bull-queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available throughout the application
      envFilePath: '.env', // Load environment variables from .env file
    }),
    DatabaseModule,
    BullQueueModule,
    PoolsModule,
    ShopDrillsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
