import { Injectable } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import {
  WalletStrategy,
  WalletConnectionResponse,
} from '../interfaces/wallet.interface';
import { WalletConnectionStatus } from '../interfaces/wallet-connection-types';

/**
 * Abstract base class for all wallet strategies
 */
@Injectable()
export abstract class BaseWalletStrategy implements WalletStrategy {
  /**
   * Get the wallet type this strategy handles
   */
  abstract getWalletType(): string;

  /**
   * Connect a wallet using the provided connection data
   */
  abstract connect(
    connectionData: Record<string, any>,
    operatorId: string,
  ): Promise<ApiResponse<WalletConnectionResponse>>;

  /**
   * Disconnect a wallet
   */
  abstract disconnect(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<boolean>>;

  /**
   * Validate a wallet connection
   */
  abstract validate(
    walletId: string,
    validationData: Record<string, any>,
  ): Promise<ApiResponse<boolean>>;

  /**
   * Create a standardized error response
   */
  protected createErrorResponse<T>(
    statusCode: number,
    message: string,
  ): ApiResponse<T> {
    return new ApiResponse<null>(
      statusCode,
      `(${this.getWalletType()}) ${message}`,
    );
  }

  /**
   * Create a standardized success response
   */
  protected createSuccessResponse<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse<T>(
      200,
      `(${this.getWalletType()}) ${message}`,
      data,
    );
  }

  /**
   * Log wallet connection events
   */
  protected logConnectionEvent(
    walletId: string,
    operatorId: string,
    eventType: 'connect' | 'disconnect' | 'validate',
    status: WalletConnectionStatus,
    metadata?: Record<string, any>,
  ): void {
    // This could be extended to store events in a database
    console.log({
      walletId,
      operatorId,
      eventType,
      timestamp: new Date(),
      status,
      metadata,
    });
  }
}
