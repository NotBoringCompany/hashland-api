import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BlockchainData } from 'src/common/schemas/blockchain-payment.schema';
import { Document, Types } from 'mongoose';
import { TGStarsData } from 'src/common/schemas/telegram-payment.schema';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({
    description: 'The database ID of the shop purchase',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator who made the purchase.
   */
  @ApiProperty({
    description: 'The database ID of the operator who made the purchase',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operator', required: true })
  operatorId: Types.ObjectId;

  /**
   * The name of the item purchased from the shop.
   */
  @ApiProperty({
    description: 'The name of the item purchased from the shop',
    example: 'REPLENISH_FUEL',
  })
  @Prop({ type: String, required: true })
  itemPurchased: string;

  /**
   * The amount of the item purchased.
   */
  @ApiProperty({
    description: 'The amount of the item purchased',
    example: 1,
  })
  @Prop({ required: true })
  amount: number;

  /**
   * The total cost of the purchase (in `currency`).
   */
  @ApiProperty({
    description: 'The total cost of the purchase',
    example: 0.95,
  })
  @Prop({ required: true })
  totalCost: number;

  /**
   * The currency used to make the purchase.
   */
  @ApiProperty({
    description: 'The currency used to make the purchase',
    example: 'TON',
  })
  @Prop({ required: true })
  currency: string;

  /**
   * If the operator purchased the item using Telegram Stars, this will contain the data received from the Telegram payment provider.
   */
  @ApiProperty({
    description:
      'Data received from the Telegram payment provider (for Telegram Stars purchases)',
    type: TGStarsData,
    required: false,
  })
  @Prop({ type: TGStarsData, required: false, default: null })
  tgStarsData?: TGStarsData;

  /**
   * If the operator purchased the item using crypto, this will contain the data received from the blockchain.
   */
  @ApiProperty({
    description: 'Data received from the blockchain (for crypto purchases)',
    type: BlockchainData,
    required: false,
  })
  @Prop({ type: BlockchainData, required: false, default: null })
  blockchainData?: BlockchainData;

  /**
   * The timestamp when the purchase was created
   */
  @ApiProperty({
    description: 'The timestamp when the purchase was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the purchase was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the purchase was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

export const ShopPurchaseSchema = SchemaFactory.createForClass(ShopPurchase);
