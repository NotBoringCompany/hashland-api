import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtTonProofService {
  private readonly logger = new Logger(JwtTonProofService.name);
  private readonly secretKey: string;
  private readonly payloadTTL: string;

  constructor(private readonly configService: ConfigService) {
    // Use a dedicated secret key for TON proofs or fall back to the regular JWT secret
    this.secretKey = this.configService.get<string>(
      'TON_PROOF_JWT_SECRET',
      this.configService.get<string>('JWT_SECRET', 'hashland-ton-secret'),
    );

    // Default TTL is 20 minutes
    this.payloadTTL = this.configService.get<string>(
      'TON_PROOF_PAYLOAD_TTL',
      '20m',
    );
  }

  /**
   * Generate a random payload for TON proof
   * @returns Random hex string
   */
  generatePayload(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a JWT token for TON proof payload
   * @param payload Data to include in the token
   * @returns JWT token string
   */
  createPayloadToken(payload: string, context?: Record<string, any>): string {
    try {
      const tokenData = {
        payload,
        iat: Math.floor(Date.now() / 1000),
        ...context,
      };

      return jwt.sign(tokenData, this.secretKey, {
        expiresIn: this.payloadTTL,
      });
    } catch (error) {
      this.logger.error(
        `Error creating payload token: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to create payload token');
    }
  }

  /**
   * Verify and decode a TON proof payload token
   * @param token The JWT token to verify
   * @returns Decoded token data or null if invalid
   */
  verifyPayloadToken(token: string): any | null {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      this.logger.error(
        `Error verifying payload token: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Decode a token without verifying it (useful for debugging)
   * @param token The JWT token to decode
   * @returns Decoded token data or null if invalid format
   */
  decodeToken(token: string): any | null {
    try {
      return jwt.decode(token);
    } catch (error) {
      this.logger.error(`Error decoding token: ${error.message}`, error.stack);
      return null;
    }
  }
}
