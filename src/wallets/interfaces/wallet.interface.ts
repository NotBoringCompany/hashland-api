import { ApiResponse } from 'src/common/dto/response.dto';

/**
 * Base interface for all wallet connections
 */
export interface WalletConnection {
  /**
   * Unique identifier for the wallet connection
   */
  id?: string;

  /**
   * Type of wallet (e.g., 'telegram', 'ethereum', etc.)
   */
  type: string;

  /**
   * Wallet address
   */
  address: string;

  /**
   * Connection timestamp
   */
  connectedAt: Date;

  /**
   * Additional metadata specific to the wallet type
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for wallet connection requests
 */
export interface WalletConnectionRequest {
  /**
   * Type of wallet to connect
   */
  walletType: string;

  /**
   * Operator ID requesting the connection
   */
  operatorId: string;

  /**
   * Connection data specific to the wallet type
   */
  connectionData: Record<string, any>;
}

/**
 * Interface for wallet connection responses
 */
export interface WalletConnectionResponse {
  /**
   * Connected wallet information
   */
  wallet: WalletConnection;

  /**
   * Authentication token if applicable
   */
  token?: string;
}

/**
 * Interface that all wallet strategies must implement
 */
export interface WalletStrategy {
  /**
   * Get the wallet type this strategy handles
   */
  getWalletType(): string;

  /**
   * Connect a wallet using the provided connection data
   */
  connect(
    connectionData: Record<string, any>,
    operatorId: string,
  ): Promise<ApiResponse<WalletConnectionResponse>>;

  /**
   * Disconnect a wallet
   */
  disconnect(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<boolean>>;

  /**
   * Validate a wallet connection
   */
  validate(
    walletId: string,
    validationData: Record<string, any>,
  ): Promise<ApiResponse<boolean>>;

  /**
   * Get wallet balance if supported
   */
  getBalance?(
    walletId: string,
  ): Promise<ApiResponse<{ balance: string; symbol: string }>>;
}
