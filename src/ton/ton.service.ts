import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import {
  BlockchainData,
  TxParsedMessage,
} from 'src/common/schemas/blockchain-payment.schema';
import TonWeb, { AddressType } from 'tonweb';

@Injectable()
export class TonService {
  private tonWeb: TonWeb | null = null; // ✅ Lazy Initialization

  constructor(private configService: ConfigService) {
    const apiEndpoint = this.configService.get<string>('TON_API_ENDPOINT');
    const apiKey = this.configService.get<string>('TON_API_KEY');

    if (!apiEndpoint || !apiKey) {
      throw new Error(
        'TON_API_ENDPOINT or TON_API_KEY is not set in the environment variables.',
      );
    }

    this.tonWeb = new TonWeb(
      new TonWeb.HttpProvider(apiEndpoint, {
        apiKey,
      }),
    );
  }

  /**
   * Verifies if a TON transaction that was made for a purchase is valid.
   *
   * Returns a `BlockchainData` object if the transaction is valid, otherwise returns `null`.
   */
  async verifyTONTransaction(
    /** The operator who initiated the purchase */
    operatorId: Types.ObjectId,
    /** The address the purchase was made from */
    address: string,
    /** The BOC (tx hash) of the purchase */
    boc: string,
  ): Promise<BlockchainData | null> {
    // Ensure all required fields are present
    if (!operatorId || !address || !boc) return null;

    const maxRetries = 5; // Maximum retry attempts
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🔄 (verifyTONTransaction) Attempt ${attempt + 1}...`);

        // ✅ Step 1: Convert BOC to transaction hash
        const txHash = await this.bocToTxHash(boc);
        if (!txHash) {
          throw new Error(
            `(verifyTONTransaction) BOC to txHash conversion failed`,
          );
        }

        console.log(
          `🔍 (verifyTONTransaction) Verifying TON transaction with tx hash ${txHash} for address ${address}...`,
        );

        // ✅ Step 2: Fetch transaction data from TON API
        const txs = await this.getTransactions(address, 1, txHash);

        if (!txs || txs.length === 0) {
          console.warn(
            `(verifyTONTransaction) No transactions found for address ${address} with tx hash ${txHash}`,
          );

          // If transaction doesn't exist at all, no need to retry
          return null;
        }

        // ✅ Step 3: Fetch the first transaction
        const firstTx = txs[0];

        if (!firstTx || !firstTx.out_msgs?.length) {
          throw new Error(
            `(verifyTONTransaction) First transaction missing out_msgs for address ${address} with tx hash ${txHash}`,
          );
        }

        console.log(
          `(verifyTONTransaction) First transaction for tx hash ${txHash}: ${JSON.stringify(firstTx, null, 2)}`,
        );

        // ✅ Step 4: Extract receiver address
        const firstOutMsg = firstTx.out_msgs[0];
        const receiverAddress = this.getNonBounceableAddress(
          firstOutMsg.destination,
        );

        console.log(
          `🔍 (verifyTONTransaction) Receiver address after setting isBounceable to false: ${receiverAddress}`,
        );

        // ✅ Step 5: Extract the transaction message payload (which contains item, amount, and cost)
        let txParsedMessage: TxParsedMessage;
        try {
          txParsedMessage = JSON.parse(firstOutMsg.message);
        } catch (parseErr) {
          throw new Error(
            `(verifyTONTransaction) Failed to parse message: ${parseErr.message}`,
          );
        }

        console.log(
          `🔍 (verifyTONTransaction) Parsed message: ${JSON.stringify(txParsedMessage, null, 2)}`,
        );

        // ✅ Step 6: Ensure the receiver address matches the expected TON receiver address
        if (receiverAddress !== process.env.TON_RECEIVER_ADDRESS) {
          throw new Error(
            `(verifyTONTransaction) Invalid receiver address: ${receiverAddress}, expected: ${process.env.TON_RECEIVER_ADDRESS}`,
          );
        }

        // ✅ Step 7: Extract the actual transaction value (amount sent to receiver)
        const txValue = parseInt(firstOutMsg.value) / Math.pow(10, 9); // Convert nanotons to TON
        console.log(
          `🔍 (verifyTONTransaction) Transaction value: ${txValue} TON`,
        );

        // ✅ Step 8: Validate transaction amount based on currency
        if (txParsedMessage.curr === 'TON') {
          const parsedMessageCost = txParsedMessage.cost;

          // 1 TON = 10^9 nanotons, so we divide by 10^9 to get the actual value in TON
          if (parsedMessageCost !== txValue) {
            throw new Error(
              `(verifyTONTransaction) Value mismatch. Expected: ${parsedMessageCost}, Received: ${txValue}`,
            );
          }
        } else {
          // If the currency is anything other than TON, reject the transaction.
          throw new Error(
            `(verifyTONTransaction) Unsupported currency: ${txParsedMessage.curr}`,
          );
        }

        // ✅ Step 9: Return the verified transaction data
        return {
          address,
          chain: 'TON',
          txHash,
          txPayload: txParsedMessage,
          success: true,
        };
      } catch (err: any) {
        console.error(
          `❌ (verifyTONTransaction) Error verifying TON transaction (Attempt ${attempt + 1}): ${err.message}`,
        );

        attempt++;

        if (attempt >= maxRetries) {
          console.error(
            `🚨 (verifyTONTransaction) Max retries reached. Returning null.`,
          );
          return null;
        }

        // ✅ Step 10: Implement exponential backoff for retries (capped at 5s max)
        const waitTime = Math.min(500 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return null; // Should never reach here, but added for safety
  }

  /**
   * Converts a BOC (bag of cells) for TON-related transactions into its corresponding transaction hash in hex format.
   */
  async bocToTxHash(boc: string): Promise<string | null> {
    try {
      // convert base64-encoded boc string into byte array
      const bocBytes = this.tonWeb.utils.base64ToBytes(boc);
      // decode boc into a single TON cell (`boc` should only contain one cell)
      const cell = this.tonWeb.boc.Cell.oneFromBoc(bocBytes);
      // calculate hash of cell to get the tx hash
      const rawHash = await cell.hash();
      // `rawHash` is still a bytes array; convert to hex
      const hash = this.tonWeb.utils.bytesToHex(rawHash);

      return hash;
    } catch (err: any) {
      throw new Error(`(bocToTxHash) ${err.message}`);
    }
  }

  /**
   * Gets one or more transactions for the given address in the TON blockchain.
   */
  async getTransactions(address: string, limit: number = 1, txHash: string) {
    return await this.tonWeb.getTransactions(address, limit, null, txHash);
  }

  /**
   * Sets a given TON address' bounceable flag to false and fetches the resulting address.
   *
   * Non-bounceable addresses are used for EOAs (where funds will not be sent back if sent to a non-existent address).
   */
  getNonBounceableAddress(address: AddressType): string {
    return new this.tonWeb.utils.Address(address)?.toString(
      true,
      true,
      false,
      false,
    );
  }
}
