import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum defining the types of hash transactions
 */
export enum HashTransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

/**
 * Enum defining the categories of hash transactions
 */
export enum HashTransactionCategory {
  WHITELIST_PAYMENT = 'whitelist_payment',
  BID_HOLD = 'bid_hold',
  BID_REFUND = 'bid_refund',
  AUCTION_WIN = 'auction_win',
  SYSTEM_REWARD = 'system_reward',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  MINING_REWARD = 'mining_reward',
  REFERRAL_BONUS = 'referral_bonus',
}

/**
 * Enum defining the status of hash transactions
 */
export enum HashTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Schema for tracking HASH currency transaction history
 */
@Schema({
  timestamps: true,
  collection: 'HashTransactions',
  versionKey: false,
})
export class HashTransaction extends Document {
  /**
   * The database ID of the hash transaction record
   */
  @ApiProperty({
    description: 'The database ID of the hash transaction record',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The operator's database ID who owns this transaction
   */
  @ApiProperty({
    description: 'The database ID of the operator who owns this transaction',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

  /**
   * The type of transaction (debit or credit)
   */
  @ApiProperty({
    description: 'The type of transaction',
    example: 'debit',
    enum: HashTransactionType,
  })
  @Prop({
    type: String,
    enum: HashTransactionType,
    required: true,
  })
  transactionType: HashTransactionType;

  /**
   * The amount of HASH involved in the transaction
   */
  @ApiProperty({
    description: 'The amount of HASH involved in the transaction',
    example: 100,
  })
  @Prop({ required: true, min: 0 })
  amount: number;

  /**
   * The category of the transaction
   */
  @ApiProperty({
    description: 'The category of the transaction',
    example: 'whitelist_payment',
    enum: HashTransactionCategory,
  })
  @Prop({
    type: String,
    enum: HashTransactionCategory,
    required: true,
  })
  category: HashTransactionCategory;

  /**
   * Description of the transaction
   */
  @ApiProperty({
    description: 'Description of the transaction',
    example: 'Payment for auction whitelist entry',
  })
  @Prop({ required: true })
  description: string;

  /**
   * Related entity ID (auction, bid, etc.)
   */
  @ApiProperty({
    description: 'Related entity ID (auction, bid, etc.)',
    example: '507f1f77bcf86cd799439013',
    required: false,
  })
  @Prop({ type: Types.ObjectId, required: false })
  relatedEntityId?: Types.ObjectId;

  /**
   * Related entity type
   */
  @ApiProperty({
    description: 'Related entity type',
    example: 'auction',
    required: false,
  })
  @Prop({ type: String, required: false })
  relatedEntityType?: string;

  /**
   * Balance before the transaction
   */
  @ApiProperty({
    description: 'Balance before the transaction',
    example: 1000,
  })
  @Prop({ required: true, min: 0 })
  balanceBefore: number;

  /**
   * Balance after the transaction
   */
  @ApiProperty({
    description: 'Balance after the transaction',
    example: 900,
  })
  @Prop({ required: true, min: 0 })
  balanceAfter: number;

  /**
   * Status of the transaction
   */
  @ApiProperty({
    description: 'Status of the transaction',
    example: 'completed',
    enum: HashTransactionStatus,
  })
  @Prop({
    type: String,
    enum: HashTransactionStatus,
    default: HashTransactionStatus.PENDING,
    required: true,
  })
  status: HashTransactionStatus;

  /**
   * Additional metadata for the transaction
   */
  @ApiProperty({
    description: 'Additional metadata for the transaction',
    example: { auctionTitle: 'Rare NFT Auction', bidAmount: 500 },
    required: false,
  })
  @Prop({ type: Object, required: false })
  metadata?: any;

  /**
   * The timestamp when the transaction was created
   */
  @ApiProperty({
    description: 'The timestamp when the transaction was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the transaction was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the transaction was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for HashTransaction
 */
export const HashTransactionSchema =
  SchemaFactory.createForClass(HashTransaction);

// Create indexes for better query performance
HashTransactionSchema.index({ operatorId: 1, createdAt: -1 });
HashTransactionSchema.index({ category: 1, createdAt: -1 });
HashTransactionSchema.index({ status: 1 });
HashTransactionSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
