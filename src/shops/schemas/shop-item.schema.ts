import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ShopItemType } from 'src/common/enums/shop.enum';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `ShopItem` represents an item that can be purchased from the shop.
 */
@Schema({
  collection: 'ShopItems',
  versionKey: false,
})
export class ShopItem extends Document {
  /**
   * The database ID of the shop item.
   */
  @ApiProperty({
    description: 'The database ID of the shop item',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  /**
   * The shop item's name.
   */
  @ApiProperty({
    description: 'The type of shop item',
    enum: ShopItemType,
    example: ShopItemType.REPLENISH_FUEL,
  })
  @Prop({ type: String, enum: ShopItemType, required: true })
  item: ShopItemType;

  /**
   * The shop item's effects.
   */
  @ApiProperty({
    description: 'The effects of the shop item',
    type: ShopItemEffects,
    example: {
      replenishFuelRatio: 1,
    },
  })
  @Prop({ type: Object, required: true })
  itemEffects: ShopItemEffects;

  /**
   * The shop item's description.
   */
  @ApiProperty({
    description: 'The description of the shop item',
    example: 'Replenishes fuel back to max capacity.',
  })
  @Prop({ type: String, required: false })
  description: string;

  /**
   * The purchase cost of the shop item (in TON).
   */
  @ApiProperty({
    description: 'The cost of the shop item in TON',
    example: 0.95,
  })
  @Prop({ required: true, default: 10 })
  purchaseCost: number;
}

export const ShopItemSchema = SchemaFactory.createForClass(ShopItem);
