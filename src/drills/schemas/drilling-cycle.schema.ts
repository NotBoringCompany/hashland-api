import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A drilling cycle represents a period of time where operators can have a chance to extract $HASH. This is similar to how a block works in a blockchain.
 *
 * Each cycle lasts a specific amount of seconds. Towards the end of the cycle, one drill will be selected as the 'extractor' (similar to a miner or a validator in a blockchain) to extract $HASH.
 * Other operators may or may not earn $HASH based on a few factors.
 */
@Schema({ collection: 'DrillingCycles' })
export class DrillingCycle extends Document {
  /**
   * The start time of the drilling cycle.
   */
  @Prop({ type: Date, required: true, default: Date.now })
  startTime: Date;

  /**
   * The end time of the drilling cycle.
   */
  @Prop({ type: Date, required: true })
  endTime: Date;

  /**
   * The database ID of the drill that was selected as the extractor for this cycle.
   */
  @Prop({ type: Types.ObjectId, ref: 'Drills', required: true, default: null })
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
  @Prop({ type: Number, required: true })
  issuedHASH: number;
}

export const DrillingCycleSchema = SchemaFactory.createForClass(DrillingCycle);
