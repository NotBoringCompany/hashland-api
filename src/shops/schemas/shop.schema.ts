import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DrillConfig } from 'common/enums/drill.enum';
import { Document } from 'mongoose';

/**
 * `ShopDrill` represents a drill that can be purchased from the shop.
 */
@Schema({ timestamps: true, collection: 'ShopDrills' })
export class ShopDrill extends Document {
  /**
   * The drill configuration.
   */
  @Prop({
    type: String,
    enum: DrillConfig,
    required: true,
    default: DrillConfig.BASIC,
  })
  drillConfig: string;

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
