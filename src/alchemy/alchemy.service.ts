import { Injectable } from '@nestjs/common';
import { Alchemy, Network } from 'alchemy-sdk';
import { formatUnits } from 'viem';

@Injectable()
export class AlchemyService {
  private alchemy: Alchemy;

  constructor() {
    // Temporarily only supporting BERA mainnet
    this.alchemy = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.BERACHAIN_MAINNET,
    });
  }

  /**
   * Fetches token balances for eligible tokens (BERA, USDC, USDT).
   */
  async getEligibleBERATokenBalances(address: string) {
    try {
      const tokenMap: Record<string, string> = {
        '0x549943e04f40284185054145c6E4e9568C1D3241': 'USDC',
        '0x779Ded0c9e1022225f8E0630b35a9b54bE713736': 'USDT',
      };

      const contractAddresses = Object.keys(tokenMap);

      const [{ tokens }, beraBalance] = await Promise.all([
        this.alchemy.core.getTokensForOwner(address, { contractAddresses }),
        this.alchemy.core.getBalance(address),
      ]);

      const formattedBalances = tokens.map(
        ({ contractAddress, rawBalance }) => ({
          token: tokenMap[contractAddress] ?? 'Unknown',
          balance: (parseFloat(rawBalance) / 1e6).toFixed(2), // 6 decimals for USDC/USDT
        }),
      );

      return [
        {
          token: 'BERA',
          balance: Number(formatUnits(beraBalance.toBigInt(), 18)).toFixed(4), // 18 decimals
        },
        ...formattedBalances,
      ];
    } catch (err: any) {
      console.error(`(getEligibleTokenBalances) Error: ${err.message}`);
      throw err;
    }
  }
}
