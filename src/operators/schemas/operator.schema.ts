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
    index: true,
  })
  _id: Types.ObjectId;

  /**
   * A unique username accompanying the operator.
   */
  @Prop({ required: true, unique: true, index: true })
  username: string;

  /**
   * The operator's asset equity (in USD) over a period of time (to be decided).
   *
   * NOTE: This can also be in real-time.
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

  /**
   * The maximum fuel capacity of the operator's drills.
   */
  @Prop({
    required: true,
    default: GAME_CONSTANTS.OPERATOR.OPERATOR_STARTING_FUEL,
  })
  maxFuel: number;

  /**
   * The current fuel capacity of the operator's drills.
   */
  @Prop({
    required: true,
    default: GAME_CONSTANTS.OPERATOR.OPERATOR_STARTING_FUEL,
  })
  currentFuel: number;

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
