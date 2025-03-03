import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * `DrillStats` represents the statistics of a drill, such as its current EFF rating.
 */
@Schema({ collection: 'DrillStats' })
export class DrillStats extends Document {
  /**
   * Reference to the Drill document.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Drills',
    required: true,
    unique: true,
    index: true,
  })
  drillId: Types.ObjectId;

  /**
   * The current EFF rating of the drill.
   */
  @Prop({ type: Number, required: true, default: 0 })
  actualEff: number;
}

export const DrillStatsSchema = SchemaFactory.createForClass(DrillStats);
