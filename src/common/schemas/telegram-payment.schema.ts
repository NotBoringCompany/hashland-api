import { Prop } from '@nestjs/mongoose';

/**
 * `TGStarsData` represents the data received from the Telegram payment provider when a operator purchases an item from the shop using Telegram Stars.
 */
export class TGStarsData {
  /** The invoice payload of the payment (contains the metadata/details of the purchase) */
  @Prop({ required: true })
  invoicePayload: string;

  /** The Telegram payment charge ID */
  @Prop({ required: true })
  telegramPaymentChargeId: string;

  /** The provider payment charge ID */
  @Prop({ required: true })
  providerPaymentChargeId: string;

  /** If the initial payment was successful; otherwise, it needs to be handled manually */
  @Prop({ required: true })
  success: boolean;
}
