import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';

@Injectable()
export class TonClientService {
  private readonly client: TonClient;

  constructor(private configService: ConfigService) {
    // Initialize TON client with the appropriate network
    const network = this.configService.get<string>('TON_NETWORK', 'mainnet');

    if (network === 'mainnet') {
      this.client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: this.configService.get<string>('TON_API_KEY'),
      });
    } else {
      // Testnet configuration
      this.client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: this.configService.get<string>('TON_API_KEY'),
      });
    }
  }

  /**
   * Get the TON balance for a wallet address
   * @param address The wallet address to check
   * @returns The balance in TON as a string
   */
  async getAddressBalance(address: string): Promise<string> {
    try {
      // Convert string address to Address object
      const tonAddress = Address.parse(address);

      // Fetch the balance in nanoTON
      const balanceNano = await this.client.getBalance(tonAddress);

      // Convert from nanoTON to TON (1 TON = 10^9 nanoTON)
      const balanceTon = Number(balanceNano) / 1_000_000_000;

      return balanceTon.toString();
    } catch (error) {
      console.error(`Error fetching TON balance for ${address}:`, error);
      throw new Error(`Failed to fetch TON balance: ${error.message}`);
    }
  }
}
