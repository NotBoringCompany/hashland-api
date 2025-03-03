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

  /**
   * The version of the drill.
   */
  @Prop({
    type: String,
    enum: DrillVersion,
    required: true,
    default: DrillVersion.BASIC,
  })
  version: string;

  /**
   * The configuration of the drill.
   */
  @Prop({
    type: String,
    enum: DrillConfig,
    required: true,
    default: DrillConfig.BASIC,
  })
  config: string;

  /**
   * If this drill is allowed to be an extractor.
   */
  @Prop({ type: Boolean, required: true, default: false })
  extractorAllowed: boolean;

  /**
   * The level of the drill.
   */
  @Prop({ type: Number, required: true, default: 1 })
  level: number;
}

export const DrillSchema = SchemaFactory.createForClass(Drill);
