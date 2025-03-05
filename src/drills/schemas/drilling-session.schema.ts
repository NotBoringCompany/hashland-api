import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * `DrillingSession` represents a period of time where an operator starts drilling for $HASH until they end the session or run out of fuel.
 */
@Schema({ collection: 'DrillingSessions', versionKey: false })
export class DrillingSession extends Document {
  /**
   * The unique identifier for the drilling session.
   * This is used to track the drilling session across different cycles.
   */
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who started the drilling session.
   */
  @Prop({ type: Types.ObjectId, ref: 'Operators', required: true, index: true })
  operatorId: Types.ObjectId;

  /**
   * The start time of the drilling session.
   */
  @Prop({ type: Date, required: true, default: Date.now })
  startTime: Date;

  /**
   * The end time of the drilling session.
   */
  @Prop({ type: Date, default: null }) // NULL if still drilling
  endTime?: Date | null;

  /**
   * How much $HASH was earned during this session.
   */
  @Prop({ type: Number, required: true, default: 0 })
  earnedHASH: number;
}

export const DrillingSessionSchema =
  SchemaFactory.createForClass(DrillingSession);
