import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
// import { createHash, createHmac } from 'crypto';
import { ApiResponse } from 'src/common/dto/response.dto';
import { BaseWalletStrategy } from './base-wallet.strategy';
import {
  WalletConnectionResponse,
  WalletConnection,
} from '../interfaces/wallet.interface';
import {
  TelegramWalletConnectionData,
  WalletConnectionStatus,
} from '../interfaces/wallet-connection-types';
import { WalletConnectionService } from '../services/wallet-connection.service';
import { WalletValidationService } from '../services/wallet-validation.service';
import { Operator } from '../../operators/schemas/operator.schema';
import { Wallet } from '../schemas/wallet.schema';
import { TonClientService } from '../services/ton-client.service';
import { OperatorWallet } from '../../operators/schemas/operator-wallet.schema';

@Injectable()
export class TelegramWalletStrategy extends BaseWalletStrategy {
  private readonly botToken: string;

  constructor(
    private configService: ConfigService,
    private walletConnectionService: WalletConnectionService,
    private walletValidationService: WalletValidationService,
    private tonClientService: TonClientService,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
  ) {
    super();
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.botToken) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
  }

  getWalletType(): string {
    return 'telegram';
  }

  /**
   * Connect a Telegram wallet
   */
  async connect(
    connectionData: Record<string, any>,
    operatorId: string,
  ): Promise<ApiResponse<WalletConnectionResponse>> {
    try {
      console.log(
        'WalletConnectionService type:',
        typeof this.walletConnectionService,
      );
      console.log(
        'WalletConnectionService methods:',
        Object.getOwnPropertyNames(
          Object.getPrototypeOf(this.walletConnectionService),
        ),
      );
      if (!this.walletConnectionService) {
        throw new Error('WalletConnectionService is not initialized');
      }

      const telegramData = connectionData as TelegramWalletConnectionData;

      // Validate the connection data
      if (!telegramData.address) {
        return this.createErrorResponse(
          400,
          'Missing wallet address in connection data',
        );
      }

      // Check if this wallet is already connected to this operator
      const existingWallet =
        await this.walletConnectionService.findWalletByAddressAndType(
          telegramData.address,
          this.getWalletType(),
          operatorId,
        );

      if (existingWallet) {
        return this.createSuccessResponse('Wallet already connected', {
          wallet: existingWallet,
        });
      }

      const isValid = await this.walletValidationService.validateTonSignature(
        telegramData.signature,
        telegramData.message,
        telegramData.address,
      );

      if (!isValid) {
        return this.createErrorResponse(401, 'Invalid TON proof signature');
      }

      // Create the wallet connection
      const walletConnection: WalletConnection = {
        type: this.getWalletType(),
        address: telegramData.address,
        connectedAt: new Date(),
        metadata: {
          tonProofTimestamp: telegramData.tonProof?.proof.timestamp,
        },
      };

      // Save the wallet connection
      const savedWallet =
        await this.walletConnectionService.saveWalletConnection(
          walletConnection,
          operatorId,
        );

      // Create operator-wallet relationship
      const operatorWallet = new this.operatorWalletModel({
        operatorId,
        walletId: savedWallet.id,
        chain: 'TON', // Using TON as the chain name for Telegram wallets
        address: telegramData.address,
        signature: telegramData.signature,
        signatureMessage: telegramData.message,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await operatorWallet.save();

      // Log the connection event
      this.logConnectionEvent(
        savedWallet.id,
        operatorId,
        'connect',
        WalletConnectionStatus.CONNECTED,
        { address: telegramData.address },
      );

      return this.createSuccessResponse('Wallet connected successfully', {
        wallet: savedWallet,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        this.createErrorResponse(
          500,
          `Error connecting wallet: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Disconnect a Telegram wallet
   */
  async disconnect(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<boolean>> {
    try {
      const result = await this.walletConnectionService.removeWalletConnection(
        walletId,
        operatorId,
        this.getWalletType(),
      );

      if (!result) {
        return this.createErrorResponse(404, 'Wallet connection not found');
      }

      // Log the disconnection event
      this.logConnectionEvent(
        walletId,
        operatorId,
        'disconnect',
        WalletConnectionStatus.DISCONNECTED,
      );

      return this.createSuccessResponse(
        'Wallet disconnected successfully',
        true,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        this.createErrorResponse(
          500,
          `Error disconnecting wallet: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Validate a Telegram wallet connection
   */
  async validate(
    walletId: string,
    validationData: Record<string, any>,
  ): Promise<ApiResponse<boolean>> {
    try {
      const wallet =
        await this.walletConnectionService.getWalletConnection(walletId);

      if (!wallet) {
        return this.createErrorResponse(404, 'Wallet connection not found');
      }

      if (wallet.type !== this.getWalletType()) {
        return this.createErrorResponse(400, 'Invalid wallet type');
      }

      // For Telegram wallets, we can validate using TON proof
      const isValid = await this.walletValidationService.validateTonSignature(
        validationData.signature,
        validationData.message,
        wallet.address,
      );

      // Log the validation event
      this.logConnectionEvent(
        walletId,
        validationData.operatorId,
        'validate',
        isValid
          ? WalletConnectionStatus.CONNECTED
          : WalletConnectionStatus.FAILED,
      );

      return this.createSuccessResponse(
        isValid ? 'Wallet validated successfully' : 'Wallet validation failed',
        isValid,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        this.createErrorResponse(
          500,
          `Error validating wallet: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Get wallet balance (optional implementation)
   */
  async getBalance(
    walletId: string,
  ): Promise<ApiResponse<{ balance: string; symbol: string }>> {
    try {
      // Get the wallet connection from the database
      const wallet =
        await this.walletConnectionService.getWalletConnection(walletId);

      if (!wallet) {
        return this.createErrorResponse(404, 'Wallet connection not found');
      }

      if (wallet.type !== this.getWalletType()) {
        return this.createErrorResponse(400, 'Invalid wallet type');
      }

      // Fetch the actual balance from TON blockchain
      const balance = await this.tonClientService.getAddressBalance(
        wallet.address,
      );

      // Log the balance retrieval
      console.log(`Retrieved balance for wallet ${walletId}: ${balance} TON`);

      return this.createSuccessResponse('Wallet balance retrieved', {
        balance,
        symbol: 'TON',
      });
    } catch (err: any) {
      console.error('Error getting wallet balance:', err);
      throw new InternalServerErrorException(
        this.createErrorResponse(
          500,
          `Error getting wallet balance: ${err.message}`,
        ),
      );
    }
  }
}
