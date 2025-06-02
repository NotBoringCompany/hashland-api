import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum defining the status of auctions
 */
export enum AuctionStatus {
  DRAFT = 'draft',
  WHITELIST_OPEN = 'whitelist_open',
  WHITELIST_CLOSED = 'whitelist_closed',
  AUCTION_ACTIVE = 'auction_active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

/**
 * Schema for whitelist configuration
 */
export interface WhitelistConfig {
  maxParticipants: number;
  entryFee: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

/**
 * Schema for auction configuration
 */
export interface AuctionConfig {
  startTime: Date;
  endTime: Date;
  minBidIncrement: number;
  reservePrice?: number;
  buyNowPrice?: number;
}

/**
 * Schema for auctions in the auction system
 */
@Schema({
  timestamps: true,
  collection: 'Auctions',
  versionKey: false,
})
export class Auction extends Document {
  /**
   * The database ID of the auction
   */
  @ApiProperty({
    description: 'The database ID of the auction',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The NFT being auctioned
   */
  @ApiProperty({
    description: 'The NFT being auctioned',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'NFTs', required: true })
  nftId: Types.ObjectId;

  /**
   * The title of the auction
   */
  @ApiProperty({
    description: 'The title of the auction',
    example: 'Rare Digital Artwork Auction',
  })
  @Prop({ required: true })
  title: string;

  /**
   * The description of the auction
   */
  @ApiProperty({
    description: 'The description of the auction',
    example: 'A unique opportunity to own this rare digital artwork',
  })
  @Prop({ required: true })
  description: string;

  /**
   * The starting price of the auction in HASH currency
   */
  @ApiProperty({
    description: 'The starting price of the auction in HASH currency',
    example: 100,
  })
  @Prop({ required: true, min: 0 })
  startingPrice: number;

  /**
   * The current highest bid amount
   */
  @ApiProperty({
    description: 'The current highest bid amount',
    example: 250,
  })
  @Prop({ required: true, default: 0, min: 0 })
  currentHighestBid: number;

  /**
   * The current winning bidder
   */
  @ApiProperty({
    description: 'The current winning bidder',
    example: '507f1f77bcf86cd799439013',
    required: false,
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'Operators',
    required: false,
    default: null,
  })
  currentWinner: Types.ObjectId | null;

  /**
   * The status of the auction
   */
  @ApiProperty({
    description: 'The status of the auction',
    example: 'auction_active',
    enum: AuctionStatus,
  })
  @Prop({
    type: String,
    enum: AuctionStatus,
    default: AuctionStatus.DRAFT,
    required: true,
  })
  status: AuctionStatus;

  /**
   * Whitelist configuration for the auction
   */
  @ApiProperty({
    description: 'Whitelist configuration for the auction',
    example: {
      maxParticipants: 100,
      entryFee: 50,
      startTime: '2024-03-19T10:00:00.000Z',
      endTime: '2024-03-20T10:00:00.000Z',
      isActive: true,
    },
  })
  @Prop({
    type: {
      maxParticipants: { type: Number, required: true, min: 1 },
      entryFee: { type: Number, required: true, min: 0 },
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
      isActive: { type: Boolean, default: false },
    },
    required: true,
  })
  whitelistConfig: WhitelistConfig;

  /**
   * Auction configuration
   */
  @ApiProperty({
    description: 'Auction configuration',
    example: {
      startTime: '2024-03-20T12:00:00.000Z',
      endTime: '2024-03-21T12:00:00.000Z',
      minBidIncrement: 10,
      reservePrice: 200,
      buyNowPrice: 1000,
    },
  })
  @Prop({
    type: {
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
      minBidIncrement: { type: Number, required: true, min: 1 },
      reservePrice: { type: Number, required: false, min: 0 },
      buyNowPrice: { type: Number, required: false, min: 0 },
    },
    required: true,
  })
  auctionConfig: AuctionConfig;

  /**
   * Total number of bids placed
   */
  @ApiProperty({
    description: 'Total number of bids placed',
    example: 15,
  })
  @Prop({ required: true, default: 0, min: 0 })
  totalBids: number;

  /**
   * Total number of participants
   */
  @ApiProperty({
    description: 'Total number of participants',
    example: 8,
  })
  @Prop({ required: true, default: 0, min: 0 })
  totalParticipants: number;

  /**
   * The timestamp when the auction was created
   */
  @ApiProperty({
    description: 'The timestamp when the auction was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the auction was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the auction was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for Auction
 */
export const AuctionSchema = SchemaFactory.createForClass(Auction);

// Create indexes for better query performance
AuctionSchema.index({ status: 1 });
AuctionSchema.index({ nftId: 1 });
AuctionSchema.index({ currentWinner: 1 });
AuctionSchema.index({
  'whitelistConfig.startTime': 1,
  'whitelistConfig.endTime': 1,
});
AuctionSchema.index({
  'auctionConfig.startTime': 1,
  'auctionConfig.endTime': 1,
});
AuctionSchema.index({ createdAt: -1 });
