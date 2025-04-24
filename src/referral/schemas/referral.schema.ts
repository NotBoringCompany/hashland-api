import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum defining the types of referrals
 */
export enum ReferralType {
  OPERATOR = 'operator',
  STARTER_CODE = 'starter_code',
}

/**
 * Schema for tracking user referrals
 */
@Schema({
  timestamps: true,
  collection: 'Referrals',
  versionKey: false,
})
export class Referral extends Document {
  /**
   * The database ID of the referral record
   */
  @ApiProperty({
    description: 'The database ID of the referral record',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The type of referral
   */
  @ApiProperty({
    description: 'The type of referral',
    example: 'operator',
    enum: ReferralType,
  })
  @Prop({
    type: String,
    enum: ReferralType,
    default: ReferralType.OPERATOR,
    required: true,
  })
  referralType: ReferralType;

  /**
   * The referring operator's ID (who shared the referral link)
   */
  @ApiProperty({
    description: 'The referring operator ID (who shared the link)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operators', required: true, index: true })
  referrerId: Types.ObjectId;

  /**
   * The referred operator's ID (who used the referral link)
   */
  @ApiProperty({
    description: 'The referred operator ID (who used the link)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operators', required: true, index: true })
  referredId: Types.ObjectId;

  /**
   * The referral code that was used
   */
  @ApiProperty({
    description: 'The referral code that was used',
    example: 'abc123xyz',
  })
  @Prop({ type: String, required: true })
  referralCode: string;

  /**
   * Whether rewards have been processed for this referral
   */
  @ApiProperty({
    description: 'Whether rewards have been processed',
    example: true,
  })
  @Prop({ type: Boolean, default: false })
  rewardsProcessed: boolean;

  /**
   * Rewards given to the referrer
   */
  @ApiProperty({
    description: 'Rewards given to the referrer',
    example: { effCredits: 100, hashBonus: 50 },
  })
  @Prop({
    type: {
      effCredits: { type: Number, default: 0 },
      hashBonus: { type: Number, default: 0 },
    },
    default: {},
  })
  referrerRewards: {
    effCredits?: number;
    hashBonus?: number;
  };

  /**
   * Rewards given to the referred user
   */
  @ApiProperty({
    description: 'Rewards given to the referred user',
    example: { effCredits: 50, hashBonus: 25 },
  })
  @Prop({
    type: {
      effCredits: { type: Number, default: 0 },
      hashBonus: { type: Number, default: 0 },
    },
    default: {},
  })
  referredRewards: {
    effCredits?: number;
    hashBonus?: number;
  };

  /**
   * The timestamp when the record was created
   */
  @ApiProperty({
    description: 'The timestamp when the record was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the record was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the record was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for Referral
 */
export const ReferralSchema = SchemaFactory.createForClass(Referral);

// Create unique index to prevent duplicate referrals
ReferralSchema.index({ referrerId: 1, referredId: 1 }, { unique: true });
