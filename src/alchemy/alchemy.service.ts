import { Injectable } from '@nestjs/common';
import { Alchemy, Network, TransactionResponse } from 'alchemy-sdk';
import { Types } from 'mongoose';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { BlockchainData } from 'src/common/schemas/blockchain-payment.schema';
import { formatUnits, parseEther } from 'viem';

@Injectable()
export class AlchemyService {
  private beraAlchemy: Alchemy;

  constructor() {
    this.beraAlchemy = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.BERACHAIN_MAINNET,
    });
  }

  /**
   * Verifies if an EVM transaction that was made for a purchase is valid.
   *
   * Returns a `BlockchainData` object if the transaction is valid, otherwise returns `null`.
   */
  async verifyEVMTransaction(
    /** The operator who initiated the purchase */
    operatorId: Types.ObjectId,
    /** The address the purchase was made from */
    address: string,
    /** The chain the purchase was made from */
    chain: AllowedChain,
    /** The transaction hash of the purchase */
    txHash: string,
    /** The name of the shop item purchased */
    shopItemName: string,
    /** The price of the shop item purchased */
    shopItemPrice: number,
  ): Promise<BlockchainData | null> {
    // Ensure all required fields are present
    if (
      !operatorId ||
      !address ||
      !chain ||
      !txHash ||
      !shopItemName ||
      !shopItemPrice ||
      shopItemPrice <= 0
    ) {
      return null;
    }

    const maxRetries = 5; // Maximum retry attempts
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🔄 (verifyEVMTransaction) Attempt ${attempt + 1}...`);
        let tx: TransactionResponse | null = null;

        // Will add support for more chains in the future if needed
        if (chain === AllowedChain.BERA) {
          tx = await this.beraAlchemy.core.getTransaction(txHash);
        }

        // ❌ Transaction not mined or invalid hash
        if (!tx || !tx.blockNumber) {
          console.error(
            `❌ (verifyEVMTransaction) Transaction failed or not found.`,
          );

          return null;
        }

        // Check sender. Ensure the transaction was sent from the correct address
        if (!tx.from || tx.from.toLowerCase() !== address.toLowerCase()) {
          console.error(
            `❌ (verifyEVMTransaction) Transaction sender does not match address.`,
          );

          return null;
        }

        // Check receiver. Ensure the transaction was sent to the correct address
        if (
          !tx.to ||
          tx.to.toLowerCase() !== process.env.EVM_RECEIVER_ADDRESS.toLowerCase()
        ) {
          console.error(
            `❌ (verifyEVMTransaction) Transaction receiver does not match address.`,
          );

          return null;
        }

        // Check value. Ensure the transaction value matches the shop item price
        const shopItemPriceInWei = parseEther(shopItemPrice.toString());
        if (!tx.value.eq(shopItemPriceInWei)) {
          console.error(
            `❌ (verifyEVMTransaction) Transaction value does not match shop item price.`,
          );

          return null;
        }

        // If all checks pass
        console.log(
          `✅ (verifyEVMTransaction) Transaction verified successfully for operatorId: ${operatorId}, address: ${address}, chain: ${chain}, txHash: ${txHash}`,
        );

        return {
          address,
          chain,
          txHash,
          txPayload: {
            item: shopItemName,
            amt: 1,
            cost: shopItemPrice,
            curr: 'BERA',
          },
          success: true,
        };
      } catch (err: any) {
        console.error(
          `❌ (verifyEVMTransaction) Error verifying EVM transaction (Attempt ${attempt + 1}): ${err.message}`,
        );

        attempt++;

        if (attempt >= maxRetries) {
          console.error(
            `🚨 (verifyEVMTransaction) Max retries reached. Returning null.`,
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
   * Fetches token balances for eligible tokens (BERA, USDC, USDT).
   */
  async getEligibleBERATokenBalances(address: string) {
    try {
      const tokenMap: Record<string, { symbol: string; decimals: number }> = {
        '0x549943e04f40284185054145c6E4e9568C1D3241': {
          symbol: 'USDC',
          decimals: 6,
        },
        '0x779Ded0c9e1022225f8E0630b35a9b54bE713736': {
          symbol: 'USDT',
          decimals: 6,
        },
        '0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce': {
          symbol: 'HONEY',
          decimals: 18,
        },
      };

      const contractAddresses = Object.keys(tokenMap);

      const [{ tokens }, beraBalance] = await Promise.all([
        this.beraAlchemy.core.getTokensForOwner(address, { contractAddresses }),
        this.beraAlchemy.core.getBalance(address),
      ]);

      const formattedBalances = tokens.map(
        ({ contractAddress, rawBalance }) => {
          const tokenInfo = tokenMap[contractAddress];
          const decimals = tokenInfo?.decimals ?? 6; // fallback default
          const symbol = tokenInfo?.symbol ?? 'Unknown';
          const balance = (
            parseFloat(rawBalance) / Math.pow(10, decimals)
          ).toFixed(decimals === 6 ? 2 : 4);

          return {
            token: symbol,
            balance,
          };
        },
      );

      return [
        {
          token: 'BERA',
          balance: Number(formatUnits(beraBalance.toBigInt(), 18)).toFixed(4),
        },
        ...formattedBalances,
      ];
    } catch (err: any) {
      console.error(`(getEligibleTokenBalances) Error: ${err.message}`);
      throw err;
    }
  }
}
