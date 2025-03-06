/**
 * This file provides a sample implementation of the Telegram wallet connection flow.
 * It demonstrates how to use the wallet integration system to connect a Telegram wallet.
 */
import { WalletConnectionRequest } from '../interfaces/wallet.interface';
import { TelegramWalletConnectionData } from '../interfaces/wallet-connection-types';
import { WalletService } from './wallet.service';

/**
 * Example function to connect a Telegram wallet
 */
export async function connectTelegramWallet(
  walletService: WalletService,
  operatorId: string,
  tonAddress: string,
  tonProof: any,
): Promise<any> {
  try {
    // Prepare the connection data
    const connectionData: TelegramWalletConnectionData = {
      address: tonAddress,
      tonProof,
    };

    // Create the connection request
    const connectionRequest: WalletConnectionRequest = {
      walletType: 'telegram',
      operatorId,
      connectionData,
    };

    // Connect the wallet
    const response = await walletService.connectWallet(connectionRequest);

    return response;
  } catch (error) {
    console.error('Error connecting Telegram wallet:', error);
    throw error;
  }
}

/**
 * Example function to validate a Telegram wallet connection
 */
export async function validateTelegramWallet(
  walletService: WalletService,
  walletId: string,
  operatorId: string,
  signature: string,
  message: string,
): Promise<any> {
  try {
    // Prepare the validation data
    const validationData = {
      signature,
      message,
      operatorId,
    };

    // Validate the wallet
    const response = await walletService.validateWallet(
      walletId,
      validationData,
    );

    return response;
  } catch (error) {
    console.error('Error validating Telegram wallet:', error);
    throw error;
  }
}

/**
 * Example function to disconnect a Telegram wallet
 */
export async function disconnectTelegramWallet(
  walletService: WalletService,
  walletId: string,
  operatorId: string,
): Promise<any> {
  try {
    // Disconnect the wallet
    const response = await walletService.disconnectWallet(walletId, operatorId);

    return response;
  } catch (error) {
    console.error('Error disconnecting Telegram wallet:', error);
    throw error;
  }
}
