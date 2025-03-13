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
  // TO BE ADDED: Upgrading max fuel capacity, restoring fuel, etc.
}
