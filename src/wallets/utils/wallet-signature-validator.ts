import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Address, beginCell } from '@ton/core';
import { TonClient } from '@ton/ton';
import * as nacl from 'tweetnacl';

@Injectable()
export class WalletSignatureValidator {
  private tonClient: TonClient;

  constructor(private configService: ConfigService) {
    // Initialize TON client
    const endpoint = this.configService.get<string>('TON_API_ENDPOINT', 'https://toncenter.com/api/v2/jsonRPC');
    const apiKey = this.configService.get<string>('TON_API_KEY', '');

    this.tonClient = new TonClient({
      endpoint,
      apiKey,
    });
  }

  /**
   * Validate a TON wallet signature
   * Uses TON SDK to verify the signature against the message and address
   */
  async validateTonSignature(
    signature: string,
    message: string,
    address: string,
  ): Promise<boolean> {
    try {
      // Convert address string to TON Address object
      const tonAddress = Address.parse(address);

      // Create a cell with the message
      const messageCell = beginCell().storeBuffer(
        Buffer.from(message)
      ).endCell();

      // Get contract state to extract public key
      const contractState = await this.tonClient.getContractState(tonAddress);
      if (!contractState || contractState.state !== 'active') {
        console.error('Contract not active or not found for address:', address);
        return false;
      }

      // Extract public key from contract state
      const publicKey = await this.extractPublicKeyFromContract(tonAddress);

      if (!publicKey) {
        console.error('Could not extract public key for address:', address);
        return false;
      }

      // Convert signature from hex to buffer
      const signatureBuffer = Buffer.from(signature, 'hex');

      // Verify the signature using the public key
      const isValid = this.verifySignature(
        publicKey,
        messageCell.hash(),
        signatureBuffer
      );

      console.log(`Validating TON signature for address ${address}: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('Error validating TON signature:', error);
      return false;
    }
  }

  /**
   * Extract public key from contract by calling get_public_key method
   */
  private async extractPublicKeyFromContract(address: Address): Promise<Buffer | null> {
    try {
      // For v3R1 and v3R2 wallets, you can use get methods to extract the public key
      const result = await this.tonClient.runMethod(address, 'get_public_key');

      // Check if result exists and has a stack
      if (result && result.stack) {
        // The stack is a TupleReader, not an array, so we need to read from it
        // Get the first item from the stack (the public key)
        const publicKeyBigInt = result.stack.readBigNumber();
        const publicKeyHex = publicKeyBigInt.toString(16).padStart(64, '0');
        return Buffer.from(publicKeyHex, 'hex');
      }

      return null;
    } catch (error) {
      console.error('Error extracting public key:', error);
      return null;
    }
  }

  /**
   * Verify a signature using TweetNaCl
   */
  private verifySignature(
    publicKey: Buffer,
    messageHash: Buffer,
    signature: Buffer
  ): boolean {
    try {
      // Use TweetNaCl to verify the signature
      return nacl.sign.detached.verify(
        messageHash,
        signature,
        publicKey
      );
    } catch (error) {
      console.error('Error in signature verification:', error);
      return false;
    }
  }

  /**
   * Generate a nonce for wallet validation
   */
  generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a challenge message for wallet validation
   * This message will be signed by the user's wallet
   */
  generateChallengeMessage(address: string, nonce: string): string {
    const appName = this.configService.get<string>('APP_NAME', 'Hashland');
    const timestamp = Date.now();

    return `${appName} authentication request for address ${address}.\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  }

  /**
   * Hash a message for signing
   */
  hashMessage(message: string): string {
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  /**
   * Verify that a message was signed within a valid timeframe
   */
  isMessageTimestampValid(message: string, maxAgeMinutes = 10): boolean {
    try {
      // Extract timestamp from message
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      if (!timestampMatch || !timestampMatch[1]) {
        return false;
      }

      const messageTimestamp = parseInt(timestampMatch[1], 10);
      const currentTimestamp = Date.now();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;

      return currentTimestamp - messageTimestamp <= maxAgeMs;
    } catch (error) {
      console.error('Error validating message timestamp:', error);
      return false;
    }
  }
}