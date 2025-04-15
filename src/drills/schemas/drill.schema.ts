import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `Drill` represents a drill owned by an operator to drill and extract $HASH.
 */
@Schema({ collection: 'Drills', versionKey: false })
export class Drill extends Document {
  /**
   * The database ID of the drill.
   */
  @ApiProperty({
    description: 'The database ID of the drill',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who owns the drill.
   */
  @ApiProperty({
    description: 'The database ID of the operator who owns the drill',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

  /**
   * The version of the drill.
   */
  @ApiProperty({
    description: 'The version of the drill',
    example: DrillVersion.BASIC,
    enum: DrillVersion,
  })
  @Prop({
    type: String,
    required: true,
    enum: DrillVersion,
    default: DrillVersion.BASIC,
  })
  version: DrillVersion;

  /**
   * The configuration of the drill.
   */
  @ApiProperty({
    description: 'The configuration of the drill',
    example: DrillConfig.BASIC,
    enum: DrillConfig,
  })
  @Prop({
    type: String,
    enum: DrillConfig,
    required: true,
    default: DrillConfig.BASIC,
  })
  config: DrillConfig;

  /**
   * If this drill is allowed to be an extractor.
   */
  @ApiProperty({
    description: 'Whether this drill is allowed to be an extractor',
    example: false,
  })
  @Prop({ type: Boolean, required: true, default: false })
  extractorAllowed: boolean;

  /**
   * If this drill is active.
   *
   * NOTE: Only active drills can receive $HASH rewards (extractor/active operator rewards).
   */
  @ApiProperty({
    description: 'Whether this drill is active',
    example: true,
  })
  @Prop({ type: Boolean, required: true, default: false })
  active: boolean;

  /**
   * The level of the drill.
   */
  @ApiProperty({
    description: 'The level of the drill',
    example: 1,
    minimum: 1,
  })
  @Prop({ type: Number, required: true, default: 1 })
  level: number;

  /**
   * The current EFF rating of the drill.
   */
  @ApiProperty({
    description: 'The current EFF rating of the drill',
    example: 100,
  })
  @Prop({ type: Number, required: true, default: 0 })
  actualEff: number;
}

export const DrillSchema = SchemaFactory.createForClass(Drill);
