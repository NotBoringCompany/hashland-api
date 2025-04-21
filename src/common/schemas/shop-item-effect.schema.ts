import { Prop } from '@nestjs/mongoose';
import { DrillConfig, DrillVersion } from '../enums/drill.enum';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `ShopItemEffectDrillData` defines the data structure for a shop drill's data.
 */
export class ShopItemEffectDrillData {
  @ApiProperty({
    description: 'The version of the drill',
    enum: DrillVersion,
    example: DrillVersion.BASIC,
  })
  @Prop({ type: String, required: true, enum: DrillVersion })
  version: DrillVersion;

  @ApiProperty({
    description: 'The configuration of the drill',
    enum: DrillConfig,
    example: DrillConfig.BASIC,
  })
  @Prop({ type: String, required: true, enum: DrillConfig })
  config: DrillConfig;

  @ApiProperty({
    description: 'The base EFF rating of the drill',
    example: 100,
  })
  @Prop({ required: true, default: 0 })
  baseEff: number;
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
  @ApiProperty({
    description: 'Drill data for drill shop items',
    type: ShopItemEffectDrillData,
    required: false,
  })
  @Prop({ type: Object, required: false, default: null })
  drillData?: ShopItemEffectDrillData;

  /**
   * If the shop item upgrades the operator's `maxFuel`, then this field will show how much the operator's `maxFuel` will increase by.
   */
  @ApiProperty({
    description: "Amount to increase the operator's max fuel capacity",
    example: 50,
    required: false,
  })
  @Prop({ required: false, default: 0 })
  maxFuelIncrease?: number;

  /**
   * If the shop item replenishes the operator's fuel, then this field will show how much the operator's fuel will be replenished by.
   *
   * This is determined by a ratio of 0 to 1 multiplied by the operator's `maxFuel`.
   */
  @ApiProperty({
    description: 'Ratio of max fuel to replenish (0-1)',
    example: 1.0,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @Prop({ required: false, default: 0 })
  replenishFuelRatio?: number;

  /**
   * If the shop item upgrades the operator's `maxActiveDrillLimit`, then this field will show the new value for `maxActiveDrillLimit`.
   */
  @ApiProperty({
    description: 'New value for max active drill limit',
    example: 10,
    required: false,
  })
  @Prop({
    required: false,
    default: 0,
  })
  upgradedMaxActiveDrillLimit?: number;
}
