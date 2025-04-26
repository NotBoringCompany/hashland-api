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

  /**
   * Injects ConfigService for configuration management.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the TonWeb instance. Initializes if not already initialized.
   */
  private getTonWebInstance(): TonWeb {
    if (!this.tonWeb) {
      const endpoint = this.configService.get<string>('TON_API_ENDPOINT');
      const apiKey = this.configService.get<string>('TON_API_KEY');
      if (!endpoint || !apiKey) {
        throw new Error(
          `(TonService) TON_API_ENDPOINT or TON_API_KEY is not set in the configuration.`,
        );
      }

      // Create an HttpProvider instance and pass it to TonWeb constructor
      const httpProvider = new TonWeb.HttpProvider(endpoint, {
        apiKey,
      });
      this.tonWeb = new TonWeb(httpProvider);
    }
    return this.tonWeb;
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
    // Log input parameters for traceability
    console.log(
      `(verifyTONTransaction) Called with operatorId: ${operatorId}, address: ${address}, boc: ${boc}`,
    );
    if (!operatorId || !address || !boc) {
      console.warn(
        '(verifyTONTransaction) Missing required parameters. Returning null.',
      );
      return null;
    }

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🔄 (verifyTONTransaction) Attempt ${attempt + 1}...`);

        // Step 1: Convert BOC to transaction hash
        let txHash: string | null = null;
        try {
          txHash = await this.bocToTxHash(boc);
          console.log(`(verifyTONTransaction) BOC parsed to txHash: ${txHash}`);
        } catch (bocErr: any) {
          console.error(
            `(verifyTONTransaction) Error parsing BOC: ${bocErr.message}`,
          );
          throw bocErr;
        }
        if (!txHash) {
          throw new Error(
            `(verifyTONTransaction) BOC to txHash conversion failed`,
          );
        }

        console.log(
          `🔍 (verifyTONTransaction) Verifying TON transaction with tx hash ${txHash} for address ${address}...`,
        );

        // Step 2: Fetch transaction data from TON API
        const txs = await this.getTransactions(address, 1, txHash);
        console.log(
          `(verifyTONTransaction) getTransactions result: ${JSON.stringify(txs, null, 2)}`,
        );

        if (!txs || txs.length === 0) {
          console.warn(
            `(verifyTONTransaction) No transactions found for address ${address} with tx hash ${txHash}`,
          );
          return null;
        }

        // Step 3: Fetch the first transaction
        const firstTx = txs[0];
        if (!firstTx || !firstTx.out_msgs?.length) {
          throw new Error(
            `(verifyTONTransaction) First transaction missing out_msgs for address ${address} with tx hash ${txHash}`,
          );
        }
        console.log(
          `(verifyTONTransaction) First transaction for tx hash ${txHash}: ${JSON.stringify(firstTx, null, 2)}`,
        );

        // Step 4: Extract receiver address
        const firstOutMsg = firstTx.out_msgs[0];
        const receiverAddress = this.getNonBounceableAddress(
          firstOutMsg.destination,
        );
        console.log(
          `🔍 (verifyTONTransaction) Receiver address after setting isBounceable to false: ${receiverAddress}`,
        );

        // Step 5: Extract the transaction message payload
        let txParsedMessage: TxParsedMessage;
        try {
          txParsedMessage = JSON.parse(firstOutMsg.message);
          console.log(
            `(verifyTONTransaction) Parsed message: ${JSON.stringify(txParsedMessage, null, 2)}`,
          );
        } catch (parseErr) {
          console.error(
            `(verifyTONTransaction) Failed to parse message: ${parseErr.message}`,
          );
          throw new Error(
            `(verifyTONTransaction) Failed to parse message: ${parseErr.message}`,
          );
        }

        // Step 6: Ensure the receiver address matches the expected TON receiver address
        const expectedReceiver = this.configService.get<string>(
          'TON_RECEIVER_ADDRESS',
        );
        if (receiverAddress !== expectedReceiver) {
          console.error(
            `(verifyTONTransaction) Invalid receiver address: ${receiverAddress}, expected: ${expectedReceiver}`,
          );
          throw new Error(
            `(verifyTONTransaction) Invalid receiver address: ${receiverAddress}, expected: ${expectedReceiver}`,
          );
        }

        // Step 7: Extract the actual transaction value
        const txValue = parseInt(firstOutMsg.value) / Math.pow(10, 9);
        console.log(
          `🔍 (verifyTONTransaction) Transaction value: ${txValue} TON (raw: ${firstOutMsg.value})`,
        );

        // Step 8: Validate transaction amount based on currency
        if (txParsedMessage.curr === 'TON') {
          const parsedMessageCost = txParsedMessage.cost;
          if (parsedMessageCost !== txValue) {
            console.error(
              `(verifyTONTransaction) Value mismatch. Expected: ${parsedMessageCost}, Received: ${txValue}`,
            );
            throw new Error(
              `(verifyTONTransaction) Value mismatch. Expected: ${parsedMessageCost}, Received: ${txValue}`,
            );
          }
        } else {
          console.error(
            `(verifyTONTransaction) Unsupported currency: ${txParsedMessage.curr}`,
          );
          throw new Error(
            `(verifyTONTransaction) Unsupported currency: ${txParsedMessage.curr}`,
          );
        }

        // Step 9: Return the verified transaction data
        const result: BlockchainData = {
          address,
          chain: 'TON',
          txHash,
          txPayload: txParsedMessage,
          success: true,
        };
        console.log(
          `(verifyTONTransaction) Transaction verified successfully. Returning: ${JSON.stringify(result, null, 2)}`,
        );
        return result;
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
        // Log retry wait time
        const waitTime = Math.min(500 * Math.pow(2, attempt), 5000);
        console.log(
          `(verifyTONTransaction) Waiting ${waitTime}ms before retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    console.warn(
      '(verifyTONTransaction) Exiting after retries. Returning null.',
    );
    return null;
  }

  /**
   * Converts a BOC (bag of cells) for TON-related transactions into its corresponding transaction hash in hex format.
   */
  async bocToTxHash(boc: string): Promise<string | null> {
    const tonWeb = this.getTonWebInstance(); // ✅ Use Lazy Initialization
    try {
      // convert base64-encoded boc string into byte array
      const bocBytes = tonWeb.utils.base64ToBytes(boc);
      // decode boc into a single TON cell (`boc` should only contain one cell)
      const cell = tonWeb.boc.Cell.oneFromBoc(bocBytes);
      // calculate hash of cell to get the tx hash
      const rawHash = await cell.hash();
      // `rawHash` is still a bytes array; convert to hex
      const hash = tonWeb.utils.bytesToHex(rawHash);

      return hash;
    } catch (err: any) {
      throw new Error(`(bocToTxHash) ${err.message}`);
    }
  }

  /**
   * Gets one or more transactions for the given address in the TON blockchain.
   */
  async getTransactions(address: string, limit: number = 1, txHash: string) {
    const tonWeb = this.getTonWebInstance(); // ✅ Use Lazy Initialization
    return await tonWeb.getTransactions(address, limit, null, txHash);
  }

  /**
   * Sets a given TON address' bounceable flag to false and fetches the resulting address.
   *
   * Non-bounceable addresses are used for EOAs (where funds will not be sent back if sent to a non-existent address).
   */
  getNonBounceableAddress(address: AddressType): string {
    const tonWeb = this.getTonWebInstance(); // ✅ Use Lazy Initialization

    return new tonWeb.utils.Address(address)?.toString(
      true,
      true,
      false,
      false,
    );
  }
}
