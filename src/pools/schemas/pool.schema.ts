import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * `Pool` represents a group where operators can join to increase cumulative EFF ratings and have a higher chance to extract more $HASH per cycle.
 */
@Schema({ timestamps: true, collection: 'Pools', versionKey: false })
export class Pool extends Document {
  /**
   * The database ID of the leader, who is an operator responsible for managing the pool.
   */
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
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 16, // Ensures name is at most 16 characters
    validate: {
      validator: (v: string) => /^[a-zA-Z0-9-_]+$/.test(v), // Allows only letters, numbers, hyphens, and underscores
      message:
        'Pool name can only contain letters, numbers, hyphens (-), and underscores (_), and must be max 16 characters.',
    },
  })
  name: string;

  /**
   * The maximum number of operators allowed in the pool.
   */
  @Prop({ type: Number, default: null }) // NULL if unlimited
  maxOperators?: number | null;

  /**
   * The pool's reward system, which includes the reward distribution for the extractor operator, leader, and active pool operators.
   */
  @Prop({
    type: {
      extractorOperator: { type: Number, required: true, default: 48.0 },
      leader: { type: Number, required: true, default: 4.0 },
      activePoolOperators: { type: Number, required: true, default: 48.0 },
    },
    required: true,
    _id: false,
  })
  rewardSystem: {
    extractorOperator: number;
    leader: number;
    activePoolOperators: number;
  };

  /**
   * Optional prerequisites to join the pool. If not provided (i.e. null), anyone can join as long as `maxOperators` is not reached.
   */
  @Prop({
    type: {
      tgChannelId: { type: String, default: null },
    },
    required: false,
    default: null,
    _id: false,
  })
  joinPrerequisites?: {
    tgChannelId?: string | null;
  } | null;
}

export const PoolSchema = SchemaFactory.createForClass(Pool);
