import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BlockchainData } from 'src/common/schemas/blockchain-payment.schema';
import { Document, Types } from 'mongoose';
import { TGStarsData } from 'src/common/schemas/telegram-payment.schema';

/**
 * `ShopPurchase` represents a purchase made in the shop.
 */
@Schema({
  timestamps: true,
  collection: 'ShopPurchases',
  versionKey: false,
})
export class ShopPurchase extends Document {
  /**
   * The database ID of the shop purchase.
   */
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who made the purchase.
   */
  @Prop({ type: Types.ObjectId, ref: 'Operator', required: true })
  operatorId: Types.ObjectId;

  /**
   * The name of the item purchased from the shop.
   */
  @Prop({ type: String, required: true })
  itemPurchased: string;

  /**
   * The amount of the item purchased.
   */
  @Prop({ required: true })
  amount: number;

  /**
   * The total cost of the purchase (in `currency`).
   */
  @Prop({ required: true })
  totalCost: number;

  /**
   * The currency used to make the purchase.
   */
  @Prop({ required: true })
  currency: string;

  /**
   * If the operator purchased the item using Telegram Stars, this will contain the data received from the Telegram payment provider.
   */
  @Prop({ type: TGStarsData, required: false, default: null })
  tgStarsData?: TGStarsData;

  /**
   * If the operator purchased the item using crypto, this will contain the data received from the blockchain.
   */
  @Prop({ type: BlockchainData, required: false, default: null })
  blockchainData?: BlockchainData;
}

export const ShopPurchaseSchema = SchemaFactory.createForClass(ShopPurchase);
