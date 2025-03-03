import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * `PoolOperator` keeps track of an operator's pool, in case they've joined one.
 */
@Schema({ timestamps: true, collection: 'PoolOperators' })
export class PoolOperator extends Document {
  /**
   * The database ID of the operator who joined the pool.
   */
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: 'Operators',
    unique: true,
  })
  operatorId: Types.ObjectId;

  /**
   * The database ID of the pool the operator belongs to.
   */
  @Prop({ type: Types.ObjectId, required: true, ref: 'Pools', index: true })
  poolId: Types.ObjectId;
}

/**
 * Generate the Mongoose schema for PoolOperator.
 */
export const PoolOperatorSchema = SchemaFactory.createForClass(PoolOperator);
