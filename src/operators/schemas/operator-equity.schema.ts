import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'OperatorEquities' })
export class OperatorEquity extends Document {
  /**
   * Reference to the Operator.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Operators',
    required: true,
    index: true,
    unique: true,
  })
  operatorId: Types.ObjectId;

  /**
   * The operator's real-time asset equity (in USD).
   */
  @Prop({ required: true, default: 0 })
  weightedAssetEquity: number;

  /**
   * The maximum cumulative EFF rating allowed for all drills owned by the operator.
   *
   * This is decided by `weightedAssetEquity`.
   */
  @Prop({ required: true, default: 0 })
  maxEffAllowed: number;
}

export const OperatorEquitySchema =
  SchemaFactory.createForClass(OperatorEquity);
