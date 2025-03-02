import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ShopItem } from 'common/enums/shop.enum';
import { BlockchainData } from 'common/schemas/blockchain-payment.schema';
import { Document, Types } from 'mongoose';

/**
 * `TxParsedMessage` represents the parsed message body from a transaction made in TON (in the future, this will be branched to support other blockchains).
 *
 * Some fields are shortened to reduce the amount of bytes in the payload to reduce TX costs.
 *
 * Used for verifying transactions.
 */
export class TxParsedMessage {
  /**
   * The name or any identifier of the item being purchased.
   */
  @Prop({ required: false })
  item: string;

  /**
   * The amount of the item being purchased.
   */
  @Prop({ required: false })
  amt: number;

  /**
   * The cost of the item being purchased.
   */
  @Prop({ required: false })
  cost: number;

  /**
   * The currency used to purchase the item.
   */
  @Prop({ required: false })
  curr: string;
}

/**
 * `TGStarsData` represents the data received from the Telegram payment provider when a user purchases an item from the shop using Telegram Stars.
 */
export class TGStarsData {
  /**
   * The invoice payload of the payment (contains the metadata/details of the purchase).
   */
  @Prop({ required: true })
  invoicePayload: string;

  /**
   * The Telegram payment charge ID.
   *
   */
  @Prop({ required: true })
  telegramPaymentChargeId: string;

  /**
   * The provider payment charge ID.
   *
   */
  @Prop({ required: true })
  providerPaymentChargeId: string;

  /**
   * If the initial payment was successful; otherwise, it needs to be handled manually.
   */
  @Prop({ required: true })
  success: boolean;
}

/**
 * `ShopPurchase` represents a purchase made in the shop.
 */
@Schema({ timestamps: true, collection: 'ShopPurchases' })
export class ShopPurchase extends Document {
  /**
   * The database ID of the operator who made the purchase.
   */
  @Prop({ type: Types.ObjectId, ref: 'Operator', required: true })
  operatorId: Types.ObjectId;

  /**
   * The item purchased from the shop.
   */
  @Prop({ type: String, enum: ShopItem, required: true })
  itemPurchased: string;

  /**
   * The amount of the item purchased.
   */
  @Prop({ required: true })
  amount: number;

  /**
   * The total cost of the purchase.
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
  @Prop({ type: TGStarsData, required: false })
  tgStarsData?: TGStarsData;

  /**
   * If the operator purchased the item using crypto, this will contain the data received from the blockchain.
   */
  @Prop({ type: BlockchainData, required: false })
  blockchainData?: BlockchainData;
}

export const ShopPurchaseSchema = SchemaFactory.createForClass(ShopPurchase);
