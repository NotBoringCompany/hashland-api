import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { Document, Types } from 'mongoose';

/**
 * `Operator` represents users who participate in drilling for $HASH.
 */
@Schema({ timestamps: true, collection: 'Operators', versionKey: false })
export class Operator extends Document {
  /**
   * The database ID of the operator.
   */
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * A unique username accompanying the operator.
   */
  @Prop({ required: true, unique: true, index: true })
  username: string;

  /**
   * The operator's latest asset equity value (in USD).
   *
   * This includes asset holdings like TON, USDT, USDC and other tokens.
   */
  @Prop({ required: true, default: 0 })
  assetEquity: number;

  /**
   * The total cumulative EFF from all drills owned by the operator.
   *
   * This is essentially the 'mining power' equivalent of the operator.
   */
  @Prop({ required: true, default: 0 })
  cumulativeEff: number;

  /**
   * A multiplier that's applied to the operator's drills' `actualEff`.
   *
   * This is decided by the operator's asset equity.
   */
  @Prop({ required: true, default: 1 })
  effMultiplier: number;

  /**
   * The maximum fuel capacity of the operator's drills.
   */
  @Prop({
    required: true,
    default: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
  })
  maxFuel: number;

  /**
   * The current fuel capacity of the operator's drills.
   */
  @Prop({
    required: true,
    default: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
  })
  currentFuel: number;

  /**
   * The total $HASH earned by the operator across all sessions so far.
   */
  @Prop({ required: true, default: 0 })
  totalEarnedHASH: number;

  /**
   * An optional Telegram profile. Should only be set if the operator logs in via Telegram.
   */
  @Prop({
    type: {
      tgId: { type: String, required: true, index: true },
      tgUsername: { type: String, required: true },
    },
    required: false, // Make the whole object optional
    default: null, // Default value when not provided
  })
  tgProfile?: {
    tgId: string;
    tgUsername: string;
  } | null;
}

/**
 * Generate the Mongoose schema for Operator.
 */
export const OperatorSchema = SchemaFactory.createForClass(Operator);
