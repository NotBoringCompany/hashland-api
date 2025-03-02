import { Prop } from '@nestjs/mongoose';
import { TxParsedMessage } from 'src/shops/schemas/shop-purchase.schema';

/**
 * `BlockchainData` represents the data received from the blockchain when a user purchases an item from the shop using crypto.
 */
export class BlockchainData {
  /**
   * The address used by the operator to make the payment.
   */
  @Prop({ required: true })
  address: string;

  /**
   * The chain the payment was done on (e.g., 'ETH', 'TON', 'BSC').
   */
  @Prop({ required: true })
  chain: string;

  /**
   * The transaction hash of the payment.
   */
  @Prop({ required: true })
  txHash: string;

  /**
   * The parsed payload message of the transaction.
   */
  @Prop({ type: TxParsedMessage, required: false })
  txPayload?: TxParsedMessage;

  /**
   * If the initial payment was successful; otherwise, it needs to be handled manually.
   */
  @Prop({ required: true, default: false })
  success: boolean;
}
