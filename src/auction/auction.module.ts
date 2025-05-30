import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OperatorModule } from '../operators/operator.module';

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

// Controllers
import { AuctionController } from './auction.controller';
import { NFTController } from './nft.controller';

// Gateways
import { AuctionGateway } from './gateways/auction.gateway';

// Filters
import { AuctionExceptionFilter } from './filters/auction-exception.filter';

@Module({
  imports: [
    ConfigModule,
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
  controllers: [AuctionController, NFTController],
  providers: [
    AuctionService,
    NFTService,
    WebSocketAuthService,
    AuctionGateway,
    AuctionNotificationService,
    AuctionExceptionFilter,
  ],
  exports: [
    MongooseModule,
    AuctionService,
    NFTService,
    WebSocketAuthService,
    AuctionGateway,
    AuctionNotificationService,
  ],
})
export class AuctionModule {}
