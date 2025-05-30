import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

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

// Controllers
import { AuctionController } from './auction.controller';
import { NFTController } from './nft.controller';

// External modules
import { OperatorModule } from 'src/operators/operator.module';

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

    // Import operator module for currency operations
    OperatorModule,
  ],
  controllers: [AuctionController, NFTController],
  providers: [AuctionService, NFTService],
  exports: [MongooseModule, AuctionService, NFTService],
})
export class AuctionModule {}
