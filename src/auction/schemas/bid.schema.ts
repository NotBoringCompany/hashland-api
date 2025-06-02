import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum defining the types of bids
 */
export enum BidType {
  REGULAR = 'regular',
  BUY_NOW = 'buy_now',
}

/**
 * Enum defining the status of bids
 */
export enum BidStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  OUTBID = 'outbid',
  WINNING = 'winning',
}

/**
 * Schema for bid metadata
 */
export interface BidMetadata {
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

/**
 * Schema for bids in the auction system
 */
@Schema({
  timestamps: true,
  collection: 'Bids',
  versionKey: false,
})
export class Bid extends Document {
  /**
   * The database ID of the bid
   */
  @ApiProperty({
    description: 'The database ID of the bid',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The auction this bid belongs to
   */
  @ApiProperty({
    description: 'The auction this bid belongs to',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'Auctions', required: true, index: true })
  auctionId: Types.ObjectId;

  /**
   * The operator who placed the bid
   */
  @ApiProperty({
    description: 'The operator who placed the bid',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operators', required: true, index: true })
  bidderId: Types.ObjectId;

  /**
   * The bid amount in HASH currency
   */
  @ApiProperty({
    description: 'The bid amount in HASH currency',
    example: 150,
  })
  @Prop({ required: true, min: 0 })
  amount: number;

  /**
   * The type of bid
   */
  @ApiProperty({
    description: 'The type of bid',
    example: 'regular',
    enum: BidType,
  })
  @Prop({
    type: String,
    enum: BidType,
    default: BidType.REGULAR,
    required: true,
  })
  bidType: BidType;

  /**
   * The status of the bid
   */
  @ApiProperty({
    description: 'The status of the bid',
    example: 'confirmed',
    enum: BidStatus,
  })
  @Prop({
    type: String,
    enum: BidStatus,
    default: BidStatus.PENDING,
    required: true,
  })
  status: BidStatus;

  /**
   * The transaction ID for the bid
   */
  @ApiProperty({
    description: 'The transaction ID for the bid',
    example: 'tx_507f1f77bcf86cd799439014',
  })
  @Prop({ required: true })
  transactionId: string;

  /**
   * Additional metadata for the bid
   */
  @ApiProperty({
    description: 'Additional metadata for the bid',
    example: {
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.1',
      timestamp: '2024-03-19T12:00:00.000Z',
    },
  })
  @Prop({
    type: {
      userAgent: { type: String, required: false },
      ipAddress: { type: String, required: false },
      timestamp: { type: Date, required: true, default: Date.now },
    },
    required: true,
    default: () => ({ timestamp: new Date() }),
  })
  metadata: BidMetadata;

  /**
   * The timestamp when the bid was created
   */
  @ApiProperty({
    description: 'The timestamp when the bid was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the bid was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the bid was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;

  // Populated fields for quick access
  bidder?: any; // Will be populated with Operator data
  auction?: any; // Will be populated with Auction data
}

/**
 * Generate the Mongoose schema for Bid
 */
export const BidSchema = SchemaFactory.createForClass(Bid);

// Create indexes for better query performance
BidSchema.index({ auctionId: 1, amount: -1 });
BidSchema.index({ auctionId: 1, createdAt: -1 });
BidSchema.index({ bidderId: 1, createdAt: -1 });
BidSchema.index({ status: 1 });
BidSchema.index({ bidType: 1 });
BidSchema.index({ auctionId: 1, bidderId: 1 });
