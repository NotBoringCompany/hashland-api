import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Auction } from './auction.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
/**
 * Enum defining the status of whitelist entries
 */
export enum WhitelistStatus {
  CONFIRMED = 'confirmed',
}

/**
 * Schema for auction whitelist entries
 */
@Schema({
  timestamps: true,
  collection: 'AuctionWhitelists',
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class AuctionWhitelist extends Document {
  /**
   * The database ID of the whitelist entry
   */
  @ApiProperty({
    description: 'The database ID of the whitelist entry',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The auction this whitelist entry belongs to
   */
  @ApiProperty({
    description: 'The auction this whitelist entry belongs to',
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
   * The auction this whitelist entry belongs to
   */
  @ApiProperty({
    description: 'The auction this whitelist entry belongs to',
  })
  auction: Auction;

  /**
   * The operator who joined the whitelist
   */
  @ApiProperty({
    description: 'The operator who joined the whitelist',
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
   * The operator who joined the whitelist
   */
  @ApiProperty({
    description: 'The operator who joined the whitelist',
  })
  operator: Operator;

  /**
   * The entry fee paid to join the whitelist
   */
  @ApiProperty({
    description: 'The entry fee paid to join the whitelist',
    example: 50,
  })
  @Prop({ required: true, min: 0 })
  entryFeePaid: number;

  /**
   * The transaction ID for the payment
   */
  @ApiProperty({
    description: 'The transaction ID for the payment',
    example: 'tx_507f1f77bcf86cd799439014',
  })
  @Prop({ required: true })
  paymentTransactionId: string;

  /**
   * The status of the whitelist entry (auto-confirmed after payment)
   */
  @ApiProperty({
    description: 'The status of the whitelist entry',
    example: 'confirmed',
    enum: WhitelistStatus,
  })
  @Prop({
    type: String,
    enum: WhitelistStatus,
    default: WhitelistStatus.CONFIRMED,
    required: true,
  })
  status: WhitelistStatus;

  /**
   * The timestamp when the operator joined the whitelist
   */
  @ApiProperty({
    description: 'The timestamp when the operator joined the whitelist',
    example: '2024-03-19T12:00:00.000Z',
  })
  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  /**
   * The timestamp when the whitelist entry was created
   */
  @ApiProperty({
    description: 'The timestamp when the whitelist entry was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the whitelist entry was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the whitelist entry was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for AuctionWhitelist
 */
export const AuctionWhitelistSchema =
  SchemaFactory.createForClass(AuctionWhitelist);

// Create indexes for better query performance
AuctionWhitelistSchema.index({ auctionId: 1, operatorId: 1 }, { unique: true });
AuctionWhitelistSchema.index({ auctionId: 1, joinedAt: 1 });
AuctionWhitelistSchema.index({ operatorId: 1, createdAt: -1 });
AuctionWhitelistSchema.index({ status: 1 });
AuctionWhitelistSchema.virtual('auction', {
  ref: Auction.name,
  localField: 'auctionId',
  foreignField: '_id',
  justOne: true,
});
AuctionWhitelistSchema.virtual('operator', {
  ref: Operator.name,
  localField: 'operatorId',
  foreignField: '_id',
  justOne: true,
});
