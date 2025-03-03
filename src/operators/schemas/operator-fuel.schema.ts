import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { GAME_CONSTANTS } from 'common/constants/game.constants';
import { Document, Types } from 'mongoose';

/**
 * `OperatorFuel` represents the max and current fuel capacities of an operator's drills.
 */
@Schema({ collection: 'OperatorFuels' })
export class OperatorFuel extends Document {
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
}

/**
 * Generate the Mongoose schema for OperatorFuel.
 */
export const OperatorFuelSchema = SchemaFactory.createForClass(OperatorFuel);
