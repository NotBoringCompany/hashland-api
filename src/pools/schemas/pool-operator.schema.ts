import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Operator } from 'src/operators/schemas/operator.schema';

/**
 * `PoolOperator` keeps track of an operator's pool, in case they've joined one.
 */
@Schema({
  timestamps: true,
  collection: 'PoolOperators',
  versionKey: false,
})
export class PoolOperator extends Document {
  /**
   * The database ID of the pool operator.
   */
  @ApiProperty({
    description: 'The database ID of the pool operator',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who joined the pool.
   */
  @ApiProperty({
    description: 'The database ID of the operator who joined the pool',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: 'Operators',
    unique: true,
    index: true,
  })
  operator: Types.ObjectId | Operator;

  /**
   * The database ID of the pool the operator belongs to.
   */
  @ApiProperty({
    description: 'The database ID of the pool the operator belongs to',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, required: true, ref: 'Pools', index: true })
  pool: Types.ObjectId;

  /**
   * The timestamp when the pool operator was created
   */
  @ApiProperty({
    description: 'The timestamp when the pool operator was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the pool operator was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the pool operator was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;

  /**
   * The total HASH rewards acquired by this operator from the pool
   */
  @ApiProperty({
    description: 'Total HASH rewards acquired by this operator from the pool',
    example: 2345.67,
  })
  @Prop({ type: Number, default: 0 })
  totalRewards: number;
}

/**
 * Generate the Mongoose schema for PoolOperator.
 */
export const PoolOperatorSchema = SchemaFactory.createForClass(PoolOperator);
