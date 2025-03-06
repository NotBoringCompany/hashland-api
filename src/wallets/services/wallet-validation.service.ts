import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { createHash } from 'crypto';
import { TelegramWalletConnectionData } from '../interfaces/wallet-connection-types';
import { WalletSignatureValidator } from '../utils/wallet-signature-validator'

@Injectable()
export class WalletValidationService {
  constructor(
    private configService: ConfigService,
    private walletSignatureValidator: WalletSignatureValidator,
  ) { }

  /**
   * Validate a TON proof from Telegram wallet
   */
  async validateTonProof(
    tonProof: TelegramWalletConnectionData['tonProof'],
    address: string,
  ): Promise<boolean> {
    if (!tonProof) {
      return false;
    }

    try {
      // Verify the address matches
      if (tonProof.tonAddress.toLowerCase() !== address.toLowerCase()) {
        return false;
      }

      // Check if proof is expired (24 hours)
      const proofTimestamp = tonProof.proof.timestamp;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp - proofTimestamp > 86400) {
        return false;
      }

      // In a real implementation, you would verify the signature using TON SDK
      // This is a placeholder for the actual signature verification
      // const isValidSignature = await verifyTonSignature(
      //   tonProof.proof.signature,
      //   tonProof.proof.payload,
      //   address
      // );

      // For now, we'll assume the signature is valid
      const isValidSignature = true;

      return isValidSignature;
    } catch (error) {
      console.error('Error validating TON proof:', error);
      return false;
    }
  }

  /**
   * Validate a TON signature
   */
  async validateTonSignature(
    signature: string,
    message: string,
    address: string,
  ): Promise<boolean> {
    if (!signature || !message || !address) {
      return false;
    }

    try {
      const isValidSignature = await this.walletSignatureValidator.validateTonSignature(
        signature,
        message,
        address
      );

      return isValidSignature;
    } catch (error) {
      console.error('Error validating TON signature:', error);
      return false;
    }
  }

  /**
   * Validate an Ethereum signature
   * This is a placeholder for future Ethereum wallet support
   */
  // async validateEthereumSignature(
  //   signature: string,
  //   message: string,
  //   address: string,
  // ): Promise<boolean> {
  //   // This would be implemented with ethers.js or web3.js
  //   // For now, return false as it's not implemented
  //   return false;
  // }

  /**
   * Generate a challenge message for wallet validation
   */
  generateChallengeMessage(address: string, nonce: string): string {
    const appName = this.configService.get<string>('APP_NAME', 'Hashland');
    const timestamp = Date.now();

    return `${appName} authentication request for address ${address}.\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  }
}
