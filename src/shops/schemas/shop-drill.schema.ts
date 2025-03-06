import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Document, Types } from 'mongoose';

/**
 * `ShopDrill` represents a drill that can be purchased from the shop.
 */
@Schema({
  timestamps: true,
  collection: 'ShopDrills',
  versionKey: false,
})
export class ShopDrill extends Document {
  /**
   * The database ID of the drill.
   */
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  /**
   * The version of the drill.
   */
  @Prop({ required: true, enum: DrillVersion, default: DrillVersion.BASIC })
  version: string;

  /**
   * The drill configuration.
   */
  @Prop({
    type: String,
    enum: DrillConfig,
    required: true,
    default: DrillConfig.BASIC,
  })
  config: string;

  /**
   * The purchase cost of the drill (in TON).
   */
  @Prop({ required: true, default: 10 })
  purchaseCost: number;

  /**
   * The base EFF rating of the drill.
   */
  @Prop({ required: true, default: 0 })
  baseEff: number;

  /**
   * The maximum level the drill can be upgraded to.
   */
  @Prop({ required: true, default: 20 })
  maxLevel: number;
}

export const ShopDrillSchema = SchemaFactory.createForClass(ShopDrill);
