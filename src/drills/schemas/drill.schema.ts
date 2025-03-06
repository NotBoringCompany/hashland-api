import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Document, Types } from 'mongoose';

/**
 * `Drill` represents a drill owned by an operator to drill and extract $HASH.
 */
@Schema({ collection: 'Drills', versionKey: false })
export class Drill extends Document {
  /**
   * The database ID of the drill.
   */
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who owns the drill.
   */
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

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

  /**
   * The current EFF rating of the drill.
   */
  @Prop({ type: Number, required: true, default: 0 })
  actualEff: number;
}

export const DrillSchema = SchemaFactory.createForClass(Drill);
