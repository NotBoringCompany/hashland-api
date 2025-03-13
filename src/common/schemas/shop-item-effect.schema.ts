import { Prop } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from '../enums/drill.enum';

/**
 * `ShopItemEffect` defines what purchasing this specific shop item will do to the operator.
 *
 * For instance, if purchasing a drill, then `drillData` is provided, granting the operator a drill with those specifications.
 */
export class ShopItemEffect {
  /**
   * If the shop item is a drill, then this field will be populated with the drill's data.
   */
  @Prop({
    type: {
      version: {
        type: String,
        enum: Object.values(DrillVersion),
        required: true,
      },
      config: {
        type: String,
        enum: Object.values(DrillConfig),
        required: true,
      },
      purchaseCost: { type: Number, required: true },
      baseEff: { type: Number, required: true },
      maxLevel: { type: Number, required: true },
    },
    required: false,
    default: null,
    _id: false,
  })
  drillData?: {
    /**
     * The version of the drill.
     */
    version: DrillVersion;

    /**
     * The drill configuration.
     */
    config: DrillConfig;

    /**
     * The purchase cost of the drill (in TON).
     */
    purchaseCost: number;

    /**
     * The base EFF rating of the drill.
     */
    baseEff: number;

    /**
     * The maximum level the drill can be upgraded to.
     */
    maxLevel: number;
  };
  // TO BE ADDED: Upgrading max fuel capacity, restoring fuel, etc.
}
