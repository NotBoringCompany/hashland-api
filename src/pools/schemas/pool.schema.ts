import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PoolPrerequisites } from 'src/common/schemas/pool-prerequisites.schema';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `Pool` represents a group where operators can join to increase cumulative EFF ratings and have a higher chance to extract more $HASH per cycle.
 */
@Schema({ timestamps: true, collection: 'Pools', versionKey: false })
export class Pool extends Document {
  /**
   * The database ID of the pool.
   */
  @ApiProperty({
    description: 'The database ID of the pool',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the leader, who is an operator responsible for managing the pool.
   */
  @ApiProperty({
    description:
      'The database ID of the leader (operator) who manages the pool',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'Operators',
    default: null,
    required: false,
  })
  leaderId?: Types.ObjectId | null;

  /**
   * The name of the pool.
   */
  @ApiProperty({
    description: 'The name of the pool',
    example: 'hashland-pool',
    maxLength: 16,
    pattern: '^[a-zA-Z0-9-_]+$',
  })
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 16,
    validate: {
      validator: (v: string) => /^[a-zA-Z0-9-_]+$/.test(v),
      message:
        'Pool name can only contain letters, numbers, hyphens (-), and underscores (_), and must be max 16 characters.',
    },
  })
  name: string;

  /**
   * The maximum number of operators allowed in the pool.
   */
  @ApiProperty({
    description: 'The maximum number of operators allowed in the pool',
    example: 10,
    required: false,
  })
  @Prop({ type: Number, default: null })
  maxOperators?: number | null;

  /**
   * The pool's reward system, which includes the reward distribution for the extractor operator, leader, and active pool operators.
   *
   * Default format is in ratio.
   */
  @ApiProperty({
    description: 'The pool reward distribution system',
    example: {
      extractorOperator: 0.48,
      leader: 0.04,
      activePoolOperators: 0.4,
      activeGlobalOperators: 0.08,
    },
  })
  @Prop({
    type: {
      extractorOperator: { type: Number, required: true, default: 0.48 },
      leader: { type: Number, required: true, default: 0.04 },
      activePoolOperators: { type: Number, required: true, default: 0.4 },
      activeGlobalOperators: { type: Number, required: true, default: 0.08 },
    },
    required: true,
    _id: false,
  })
  rewardSystem: {
    extractorOperator: number;
    leader: number;
    activePoolOperators: number;
    activeGlobalOperators: number;
  };

  /**
   * Optional prerequisites to join the pool. If not provided (i.e. null), anyone can join as long as `maxOperators` is not reached.
   */
  @ApiProperty({
    description: 'Prerequisites that must be met to join the pool',
    required: false,
    type: () => PoolPrerequisites,
  })
  @Prop({
    required: false,
    default: null,
    _id: false,
  })
  joinPrerequisites?: PoolPrerequisites | null;

  /**
   * The timestamp when the pool was created
   */
  @ApiProperty({
    description: 'The timestamp when the pool was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the pool was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the pool was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;

  /**
   * The estimated total efficiency (Eff) of all operators in this pool.
   * This is calculated by summing the weightedEff (cumulativeEff * effMultiplier) of all operators in the pool.
   */
  @ApiProperty({
    description: 'The estimated total efficiency of all operators in this pool',
    example: 125000,
  })
  @Prop({ type: Number, default: 0 })
  estimatedEff: number;

  /**
   * The timestamp when the estimated efficiency was last updated.
   * Updated periodically (every 6 hours) to avoid frequent recalculations.
   */
  @ApiProperty({
    description: 'Timestamp when the estimated efficiency was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  @Prop({ type: Date, default: null })
  lastEffUpdate: Date | null;

  /**
   * The total HASH rewards acquired by this pool throughout its lifetime
   */
  @ApiProperty({
    description: 'Total HASH rewards acquired by this pool',
    example: 10000.5,
  })
  @Prop({ type: Number, default: 0 })
  totalRewards: number;
}

export const PoolSchema = SchemaFactory.createForClass(Pool);
