import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Auction } from './auction.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
/**
 * Enum defining the types of auction actions
 */
export enum AuctionAction {
  WHITELIST_JOINED = 'whitelist_joined',
  WHITELIST_OPENED = 'whitelist_opened',
  WHITELIST_CLOSED = 'whitelist_closed',
  AUCTION_STARTED = 'auction_started',
  BID_PLACED = 'bid_placed',
  BID_OUTBID = 'bid_outbid',
  AUCTION_WON = 'auction_won',
  AUCTION_ENDED = 'auction_ended',
}

/**
 * Schema for auction history details
 */
export interface AuctionHistoryDetails {
  amount?: number;
  previousAmount?: number;
  metadata?: any;
}

/**
 * Schema for tracking auction history and events
 */
@Schema({
  timestamps: true,
  collection: 'AuctionHistory',
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class AuctionHistory extends Document {
  /**
   * The database ID of the history record
   */
  @ApiProperty({
    description: 'The database ID of the history record',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The auction this history record belongs to
   */
  @ApiProperty({
    description: 'The auction this history record belongs to',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: Auction.name,
    required: true,
    index: true,
  })
  auctionId: Types.ObjectId;

  /**
   * The auction this history record belongs to
   */
  @ApiProperty({
    description: 'The auction this history record belongs to',
  })
  auction: Auction;

  /**
   * The operator who performed the action
   */
  @ApiProperty({
    description: 'The operator who performed the action',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({
    type: Types.ObjectId,
    ref: Operator.name,
    required: true,
    index: true,
  })
  operatorId: Types.ObjectId;

  /**
   * The operator who performed the action
   */
  @ApiProperty({
    description: 'The operator who performed the action',
  })
  operator: Operator;

  /**
   * The action that was performed
   */
  @ApiProperty({
    description: 'The action that was performed',
    example: 'bid_placed',
    enum: AuctionAction,
  })
  @Prop({
    type: String,
    enum: AuctionAction,
    required: true,
  })
  action: AuctionAction;

  /**
   * Additional details about the action
   */
  @ApiProperty({
    description: 'Additional details about the action',
    example: {
      amount: 150,
      previousAmount: 100,
      metadata: { bidType: 'regular' },
    },
  })
  @Prop({
    type: {
      amount: { type: Number, required: false },
      previousAmount: { type: Number, required: false },
      metadata: { type: Object, required: false },
    },
    required: false,
    default: {},
  })
  details: AuctionHistoryDetails;

  /**
   * The timestamp when the action occurred
   */
  @ApiProperty({
    description: 'The timestamp when the action occurred',
    example: '2024-03-19T12:00:00.000Z',
  })
  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;

  /**
   * The timestamp when the history record was created
   */
  @ApiProperty({
    description: 'The timestamp when the history record was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * Generate the Mongoose schema for AuctionHistory
 */
export const AuctionHistorySchema =
  SchemaFactory.createForClass(AuctionHistory);

// Create indexes for better query performance
AuctionHistorySchema.index({ auctionId: 1, timestamp: -1 });
AuctionHistorySchema.index({ operatorId: 1, timestamp: -1 });
AuctionHistorySchema.index({ action: 1, timestamp: -1 });
AuctionHistorySchema.index({ auctionId: 1, action: 1 });
AuctionHistorySchema.virtual('auction', {
  ref: Auction.name,
  localField: 'auctionId',
  foreignField: '_id',
  justOne: true,
});
AuctionHistorySchema.virtual('operator', {
  ref: Operator.name,
  localField: 'operatorId',
  foreignField: '_id',
  justOne: true,
});
