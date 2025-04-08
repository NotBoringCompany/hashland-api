import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `DrillingCycleRewardShare` represents the reward share of an operator in a drilling cycle.
 */
@Schema({
  timestamps: false,
  collection: 'DrillingCycleRewardShares',
  versionKey: false,
})
export class DrillingCycleRewardShare extends Document {
  /**
   * The database ID of the reward share instance.
   */
  @ApiProperty({
    description: 'The database ID of the reward share instance',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The cycle number this reward share was issued in.
   */
  @ApiProperty({
    description: 'The cycle number this reward share was issued in',
    example: 1,
  })
  @Prop({ type: Number, required: true, index: true })
  cycleNumber: number;

  /**
   * The operator's database ID.
   */
  @ApiProperty({
    description: 'The database ID of the operator who owns this wallet',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

  /**
   * The amount of $HASH the operator received.
   */
  @ApiProperty({
    description: 'The amount of $HASH the operator received',
    example: 100,
  })
  @Prop({ type: Number, required: true })
  amount: number;
}

/**
 * Generate the Mongoose schema for DrillingCycleRewardShare.
 */
export const DrillingCycleRewardShareSchema = SchemaFactory.createForClass(
  DrillingCycleRewardShare,
);
