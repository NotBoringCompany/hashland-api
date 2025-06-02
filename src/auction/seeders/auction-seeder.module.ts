import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuctionSeeder } from './auction.seeder';
import { NFT, NFTSchema } from '../schemas/nft.schema';
import { Auction, AuctionSchema } from '../schemas/auction.schema';
import {
  AuctionWhitelist,
  AuctionWhitelistSchema,
} from '../schemas/auction-whitelist.schema';
import { Bid, BidSchema } from '../schemas/bid.schema';
import {
  AuctionHistory,
  AuctionHistorySchema,
} from '../schemas/auction-history.schema';
import {
  Operator,
  OperatorSchema,
} from '../../operators/schemas/operator.schema';

/**
 * Module for auction seeding functionality
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NFT.name, schema: NFTSchema },
      { name: Auction.name, schema: AuctionSchema },
      { name: AuctionWhitelist.name, schema: AuctionWhitelistSchema },
      { name: Bid.name, schema: BidSchema },
      { name: AuctionHistory.name, schema: AuctionHistorySchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
  ],
  providers: [AuctionSeeder],
  exports: [AuctionSeeder],
})
export class AuctionSeederModule {}
