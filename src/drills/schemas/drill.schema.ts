import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from 'common/enums/drill.enum';
import { Document } from 'mongoose';

/**
 * `Drill` represents a drill owned by an operator to drill and extract $HASH.
 */
@Schema({ collection: 'Drills' })
export class Drill extends Document {
  /**
   * The database ID of the operator who owns the drill.
   */
  @Prop({ type: String, required: true })
  operatorId: string;

  @Prop({
    type: String,
    enum: DrillVersion,
    required: true,
    default: DrillVersion.BASIC,
  })
  version: string;

  @Prop({
    type: String,
    enum: DrillConfig,
    required: true,
    default: DrillConfig.BASIC,
  })
  config: string;

  @Prop({ type: Boolean, required: true, default: false })
  extractorAllowed: boolean;

  @Prop({ type: Number, required: true, default: 1 })
  level: number;

  @Prop({ type: Number, required: true, default: 0 })
  actualEff: number;
}

export const DrillSchema = SchemaFactory.createForClass(Drill);
