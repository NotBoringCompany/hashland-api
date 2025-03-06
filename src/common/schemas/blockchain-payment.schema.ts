import { Prop } from '@nestjs/mongoose';

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
 * `BlockchainData` represents the data received from the blockchain when a operator purchases an item from the shop using crypto.
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
