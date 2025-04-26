import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import {
  BlockchainData,
  TxParsedMessage,
} from 'src/common/schemas/blockchain-payment.schema';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class TonService {
  private readonly apiEndpoint: string;
  private readonly apiKey: string;
  private readonly receiverAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.apiEndpoint =
      this.configService.get<string>('TON_API_ENDPOINT') ||
      'https://toncenter.com/api/v2';
    this.apiKey = this.configService.get<string>('TON_API_KEY');
    this.receiverAddress = this.configService.get<string>(
      'TON_RECEIVER_ADDRESS',
    );

    if (!this.apiKey) {
      console.warn('TON_API_KEY is not set. API rate limits may apply.');
    }

    if (!this.receiverAddress) {
      console.warn(
        'TON_RECEIVER_ADDRESS is not set. Transaction verification will fail.',
      );
    }
  }

  /**
   * Makes an API call to the TON API.
   */
  private async callTonApi(method: string, params: any = {}): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key if available
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await axios.post(
        `${this.apiEndpoint}/jsonRPC`,
        {
          id: '1',
          jsonrpc: '2.0',
          method,
          params,
        },
        { headers },
      );

      if (response.data.error) {
        throw new Error(
          `TON API error: ${JSON.stringify(response.data.error)}`,
        );
      }

      return response.data.result;
    } catch (error) {
      console.error(`Error calling TON API method ${method}:`, error);
      throw new HttpException(
        `Failed to call TON API: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Converts a base64 BOC string to a hash.
   * This implementation uses the built-in crypto module to calculate the hash.
   */
  async bocToTxHash(boc: string): Promise<string> {
    try {
      // Decode base64 to buffer
      const bocBuffer = Buffer.from(boc, 'base64');

      // Calculate SHA-256 hash of the buffer
      const hash = crypto.createHash('sha256').update(bocBuffer).digest('hex');

      console.log(`BOC converted to hash: ${hash}`);
      return hash;
    } catch (error) {
      console.error('Error converting BOC to hash:', error);
      throw new Error(`Failed to convert BOC to hash: ${error.message}`);
    }
  }

  /**
   * Gets transactions for the given address using the TON API.
   */
  async getTransactions(
    address: string,
    limit: number = 10,
    hash?: string,
  ): Promise<any[]> {
    const params: any = { address, limit };

    if (hash) {
      params.hash = hash;
    }

    return await this.callTonApi('getTransactions', params);
  }

  /**
   * Gets the latest transactions for the given address by message hash.
   */
  async getTransactionsByMessageHash(msgHash: string): Promise<any[]> {
    return await this.callTonApi('getTransactionsByMessageHash', {
      msg_hash: msgHash,
    });
  }

  /**
   * Formats an address to non-bounceable format.
   */
  getNonBounceableAddress(address: string): string {
    // For now, we'll just return the address as is
    // In a full implementation, you would convert to non-bounceable format
    return address;
  }

  /**
   * Verifies if a TON transaction that was made for a purchase is valid.
   * Uses direct API calls instead of TonWeb.
   */
  async verifyTONTransaction(
    operatorId: Types.ObjectId,
    address: string,
    boc: string,
  ): Promise<BlockchainData | null> {
    console.log(
      `(verifyTONTransaction) Called with operatorId: ${operatorId}, address: ${address}, boc: ${boc}`,
    );

    if (!operatorId || !address || !boc) {
      console.warn('Missing required parameters. Returning null.');
      return null;
    }

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🔄 Verification attempt ${attempt + 1}...`);

        // Step 1: Send the BOC to get its message hash
        // Either decode locally or call an API endpoint
        const bocHash = await this.callTonApi('sendBocReturnHash', { boc });
        console.log(`BOC sent, hash: ${bocHash}`);

        if (!bocHash) {
          throw new Error('Failed to get transaction hash from BOC');
        }

        // Step 2: Wait a moment for the transaction to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 3: Get the transaction by message hash
        const transactions = await this.getTransactionsByMessageHash(bocHash);

        if (!transactions || transactions.length === 0) {
          console.warn(`No transactions found with message hash ${bocHash}`);
          // Try getting by address instead
          const addrTxs = await this.getTransactions(address, 5);
          console.log(
            `Found ${addrTxs.length} recent transactions for address ${address}`,
          );

          if (addrTxs.length === 0) {
            throw new Error(`No transactions found for address ${address}`);
          }

          // Try to find one with matching hash
          const matchingTx = addrTxs.find(
            (tx) =>
              tx.in_msg?.msg_data?.hash === bocHash || tx.hash === bocHash,
          );

          if (!matchingTx) {
            throw new Error(
              `Transaction with hash ${bocHash} not found in recent transactions`,
            );
          }

          console.log(`Found matching transaction: ${matchingTx.hash}`);
        }

        // Step 4: Verify the transaction details
        const tx = transactions[0] || null;

        if (!tx || !tx.out_msgs || tx.out_msgs.length === 0) {
          throw new Error('Transaction has no output messages');
        }

        // Step 5: Extract and verify transaction details
        const outMsg = tx.out_msgs[0];
        const receiverAddress = this.getNonBounceableAddress(
          outMsg.destination,
        );
        console.log(`Receiver address: ${receiverAddress}`);

        // Step 6: Check receiver address
        const expectedReceiver = this.receiverAddress;
        if (receiverAddress !== expectedReceiver) {
          throw new Error(
            `Invalid receiver address: ${receiverAddress}, expected: ${expectedReceiver}`,
          );
        }

        // Step 7: Parse message payload
        let txParsedMessage: TxParsedMessage;
        try {
          txParsedMessage = JSON.parse(outMsg.message || '{}');
          console.log(`Transaction message:`, txParsedMessage);
        } catch (error) {
          throw new Error(`Failed to parse message: ${error.message}`);
        }

        // Step 8: Verify amount
        const txValue = parseInt(outMsg.value) / Math.pow(10, 9);
        console.log(`Transaction value: ${txValue} TON`);

        if (txParsedMessage.curr === 'TON') {
          const expectedValue = txParsedMessage.cost;
          if (expectedValue !== txValue) {
            throw new Error(
              `Value mismatch. Expected: ${expectedValue}, Received: ${txValue}`,
            );
          }
        } else {
          throw new Error(`Unsupported currency: ${txParsedMessage.curr}`);
        }

        // Step 9: Return verified transaction data
        const result: BlockchainData = {
          address,
          chain: 'TON',
          txHash: tx.hash,
          txPayload: txParsedMessage,
          success: true,
        };

        console.log(`Transaction verified successfully`);
        return result;
      } catch (error) {
        console.error(
          `Error verifying transaction (Attempt ${attempt + 1}): ${error.message}`,
        );
        attempt++;

        if (attempt >= maxRetries) {
          console.error(`Max retries reached. Returning null.`);
          return null;
        }

        // Wait with exponential backoff before retrying
        const waitTime = Math.min(500 * Math.pow(2, attempt), 5000);
        console.log(`Waiting ${waitTime}ms before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return null;
  }
}
