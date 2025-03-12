import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ShopItemType } from 'src/common/enums/shop.enum';
import { ShopItemEffect } from 'src/common/schemas/shop-item-effect.schema';

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
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  /**
   * The shop item's name.
   */
  @Prop({ type: String, enum: ShopItemType, required: true })
  item: ShopItemType;

  /**
   * The shop item's effect.
   */
  @Prop({ type: Object, required: true })
  itemEffect: ShopItemEffect;

  /**
   * The shop item's description.
   */
  @Prop({ type: String, required: false })
  description: string;

  /**
   * The purchase cost of the shop item (in TON).
   */
  @Prop({ required: true, default: 10 })
  purchaseCost: number;
}

export const ShopItemSchema = SchemaFactory.createForClass(ShopItem);
