import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { OperatorModule } from '../operators/operator.module';

// Queue configuration
import { getBullConfig, QUEUE_NAMES } from './config/queue.config';

// Schemas
import { NFT, NFTSchema } from './schemas/nft.schema';
import { Auction, AuctionSchema } from './schemas/auction.schema';
import {
  AuctionWhitelist,
  AuctionWhitelistSchema,
} from './schemas/auction-whitelist.schema';
import { Bid, BidSchema } from './schemas/bid.schema';
import {
  AuctionHistory,
  AuctionHistorySchema,
} from './schemas/auction-history.schema';

// External schemas
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import {
  HashTransaction,
  HashTransactionSchema,
} from 'src/operators/schemas/hash-transaction.schema';

// Services
import { AuctionService } from './auction.service';
import { NFTService } from './nft.service';
import { WebSocketAuthService } from './services/websocket-auth.service';
import { AuctionNotificationService } from './services/auction-notification.service';
import { BidQueueService } from './services/bid-queue.service';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';

// Controllers
import { AuctionController } from './auction.controller';
import { NFTController } from './nft.controller';
import { QueueController } from './controllers/queue.controller';
import { LifecycleController } from './controllers/lifecycle.controller';

// Gateways
import { AuctionGateway } from './gateways/auction.gateway';

// Processors
import { BidProcessor } from './processors/bid.processor';

// Filters
import { AuctionExceptionFilter } from './filters/auction-exception.filter';

@Module({
  imports: [
    ConfigModule,

    // Schedule Module for cron jobs
    ScheduleModule.forRoot(),

    // Bull Queue Module
    BullModule.forRoot(getBullConfig()),
    BullModule.registerQueue({
      name: QUEUE_NAMES.BID_PROCESSING,
    }),

    MongooseModule.forFeature([
      // Auction system schemas
      { name: NFT.name, schema: NFTSchema },
      { name: Auction.name, schema: AuctionSchema },
      { name: AuctionWhitelist.name, schema: AuctionWhitelistSchema },
      { name: Bid.name, schema: BidSchema },
      { name: AuctionHistory.name, schema: AuctionHistorySchema },

      // External schemas needed for operations
      { name: Operator.name, schema: OperatorSchema },
      { name: HashTransaction.name, schema: HashTransactionSchema },
    ]),

    // JWT module for WebSocket authentication
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '24h' },
    }),

    // Import operator module for currency operations
    OperatorModule,
  ],
  controllers: [
    AuctionController,
    NFTController,
    QueueController,
    LifecycleController,
  ],
  providers: [
    AuctionService,
    NFTService,
    WebSocketAuthService,
    AuctionGateway,
    AuctionNotificationService,
    BidQueueService,
    BidProcessor,
    AuctionLifecycleService,
    AuctionExceptionFilter,
  ],
  exports: [
    MongooseModule,
    AuctionService,
    NFTService,
    WebSocketAuthService,
    AuctionGateway,
    AuctionNotificationService,
    BidQueueService,
    AuctionLifecycleService,
  ],
})
export class AuctionModule {}
