import { Prop } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from '../enums/drill.enum';

/**
 * `ShopItemEffectDrillData` defines the data structure for a shop drill's data.
 */
export class ShopItemEffectDrillData {
  @Prop({ type: String, required: true, enum: DrillVersion })
  version: DrillVersion;

  @Prop({ type: String, required: true, enum: DrillConfig })
  config: DrillConfig;

  @Prop({ required: true, default: 0 })
  baseEff: number;

  @Prop({ required: true, default: 0 })
  maxLevel: number;
}

/**
 * `ShopItemEffects` defines what purchasing this specific shop item will do to the operator.
 *
 * For instance, if purchasing a drill, then `drillData` is provided, granting the operator a drill with those specifications.
 */
export class ShopItemEffects {
  /**
   * If the shop item is a drill, then this field will be populated with the drill's data.
   */
  @Prop({ type: Object, required: false, default: null })
  drillData?: ShopItemEffectDrillData;
  /**
   * If the shop item upgrades the operator's `maxFuel`, then this field will show how much the operator's `maxFuel` will increase by.
   */
  @Prop({ required: false, default: 0 })
  maxFuelIncrease?: number;
  /**
   * If the shop item replenishes the operator's fuel, then this field will show how much the operator's fuel will be replenished by.
   *
   * This is determined by a ratio of 0 to 1 multiplied by the operator's `maxFuel`.
   */
  @Prop({ required: false, default: 0 })
  replenishFuelRatio?: number;
}
