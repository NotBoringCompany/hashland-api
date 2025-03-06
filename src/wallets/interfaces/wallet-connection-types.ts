/**
 * Base wallet connection data
 */
export interface BaseWalletConnectionData {
  address: string;
  signature?: string;
  message?: string;
}

/**
 * Telegram wallet connection data
 */
export interface TelegramWalletConnectionData extends BaseWalletConnectionData {
  tonProof?: {
    proof: {
      timestamp: number;
      domain: {
        lengthBytes: number;
        value: string;
      };
      signature: string;
      payload: string;
    };
    tonAddress: string;
  };
  tonConnectProof?: {
    address: string;
    proof: {
      timestamp: number;
      domain: string;
      signature: string;
      payload: string;
    };
  };
}

/**
 * Ethereum wallet connection data
 */
export interface EthereumWalletConnectionData extends BaseWalletConnectionData {
  chainId: number;
  nonce: string;
}

/**
 * Wallet validation data
 */
export interface WalletValidationData {
  signature: string;
  message: string;
  address: string;
  additionalData?: Record<string, any>;
}

/**
 * Wallet connection status
 */
export enum WalletConnectionStatus {
  CONNECTED = 'connected',
  PENDING = 'pending',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

/**
 * Wallet connection event
 */
export interface WalletConnectionEvent {
  walletId: string;
  operatorId: string;
  eventType: 'connect' | 'disconnect' | 'validate';
  timestamp: Date;
  status: WalletConnectionStatus;
  metadata?: Record<string, any>;
}
