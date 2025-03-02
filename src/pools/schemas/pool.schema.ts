import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'Pools' })
export class Pool extends Document {
  /**
   * The database ID of the leader, who is an operator responsible for managing the pool.
   */
  @Prop({ type: Types.ObjectId, required: true, ref: 'Operators' })
  leaderId: Types.ObjectId;

  /**
   * The name of the pool.
   */
  @Prop({ type: String, required: true, index: true, unique: true })
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
  })
  joinPrerequisites?: {
    tgChannelId?: string | null;
  } | null;
}

export const PoolSchema = SchemaFactory.createForClass(Pool);
