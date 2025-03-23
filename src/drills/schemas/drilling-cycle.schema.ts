import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

/**
 * Represents a reward share given to an operator in a drilling cycle.
 */
export class RewardShare {
  /**
   * The database ID of the operator who received the reward.
   */
  @Prop({ type: Types.ObjectId, ref: 'Operators', required: true })
  operatorId: Types.ObjectId;

  /**
   * The username of the operator who received the reward.
   */
  @Prop({ type: String })
  operatorName: string;

  /**
   * The amount of $HASH the operator received.
   */
  @Prop({ type: Number, required: true })
  amount: number;
}

/**
 * A drilling cycle represents a period of time where operators can have a chance to extract $HASH. This is similar to how a block works in a blockchain.
 *
 * Each cycle lasts a specific amount of seconds. Towards the end of the cycle, one drill will be selected as the 'extractor' (similar to a miner or a validator in a blockchain) to extract $HASH.
 * Other operators may or may not earn $HASH based on a few factors.
 */
@Schema({ collection: 'DrillingCycles', versionKey: false })
export class DrillingCycle extends Document {
  /**
   * The database ID of the drilling cycle.
   */
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The current cycle number.
   */
  @Prop({ type: Number, required: true, default: 1, index: true, unique: true })
  cycleNumber: number;

  /**
   * The start time of the drilling cycle.
   */
  @Prop({ type: Date, required: true, default: Date.now })
  startTime: Date;

  /**
   * The end time of the drilling cycle.
   */
  @Prop({ type: Date, default: null })
  endTime: Date;

  /**
   * The database ID of the drill that was selected as the extractor for this cycle.
   */
  @Prop({ type: Types.ObjectId, ref: 'Drills', default: null })
  extractorId: Types.ObjectId | null;

  /**
   * The number of active operators during this cycle.
   */
  @Prop({ type: Number, required: true, default: 0 })
  activeOperators: number;

  /**
   * An arbitrary difficulty value that determines how hard it is to extract $HASH during this cycle.
   */
  @Prop({ type: Number, required: true, default: 0 })
  difficulty: number;

  /**
   * The total amount of $HASH that was issued during this cycle.
   */
  @Prop({
    type: Number,
    required: true,
    default: GAME_CONSTANTS.HASH_ISSUANCE.CYCLE_HASH_ISSUANCE,
  })
  issuedHASH: number;

  /**
   * The database ID of the operator who owns the extractor drill.
   */
  @Prop({ type: Types.ObjectId, ref: 'Operators', default: null })
  extractorOperatorId: Types.ObjectId | null;

  /**
   * The name of the operator who owns the extractor drill.
   */
  @Prop({ type: String, default: null })
  extractorOperatorName: string | null;

  /**
   * The detailed reward shares for all operators who received rewards in this cycle.
   */
  @Prop({ type: [RewardShare], default: [] })
  rewardShares: RewardShare[];

  /**
   * The total weighted efficiency from all operators in this cycle.
   * This is calculated during the extractor selection process.
   */
  @Prop({ type: Number, default: 0 })
  totalWeightedEff: number;
}

export const DrillingCycleSchema = SchemaFactory.createForClass(DrillingCycle);
