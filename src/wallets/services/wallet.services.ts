import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponse } from '../../common/dto/response.dto';
import {
  WalletStrategy,
  WalletConnectionRequest,
  WalletConnectionResponse,
  WalletConnection,
} from '../interfaces/wallet.interface';
import { WalletConnectionService } from './wallet-connection.service';
import { Wallet } from '../schemas/wallet.schema';
import { Operator } from '../../operators/schemas/operator.schema';
import { TelegramWalletStrategy } from '../strategies/telegram-wallet.strategy';

@Injectable()
export class WalletService {
  private strategies: Map<string, WalletStrategy> = new Map();

  constructor(
    private moduleRef: ModuleRef,
    private walletConnectionService: WalletConnectionService,
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {
    // Register wallet strategies
    this.registerStrategy(
      this.moduleRef.get(TelegramWalletStrategy, { strict: false }),
    );
    // Register additional strategies as they are implemented
    // this.registerStrategy(this.moduleRef.get(EthereumWalletStrategy, { strict: false }));
  }

  /**
   * Register a wallet strategy
   */
  registerStrategy(strategy: WalletStrategy): void {
    this.strategies.set(strategy.getWalletType(), strategy);
  }

  /**
   * Get a wallet strategy by type
   */
  getStrategy(walletType: string): WalletStrategy {
    const strategy = this.strategies.get(walletType);
    if (!strategy) {
      throw new BadRequestException(`Unsupported wallet type: ${walletType}`);
    }
    return strategy;
  }

  /**
   * Connect a wallet using the appropriate strategy
   */
  async connectWallet(
    connectionRequest: WalletConnectionRequest,
  ): Promise<ApiResponse<WalletConnectionResponse>> {
    try {
      const { walletType, operatorId, connectionData } = connectionRequest;

      // Get the appropriate strategy
      const strategy = this.getStrategy(walletType);

      // Connect the wallet using the strategy
      return strategy.connect(connectionData, operatorId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      return new ApiResponse<WalletConnectionResponse>(
        500,
        `Error connecting wallet: ${error.message}`,
        null,
      );
    }
  }

  /**
   * Disconnect a wallet
   */
  async disconnectWallet(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<boolean>> {
    try {
      // Get the wallet to determine its type
      const wallet =
        await this.walletConnectionService.getWalletConnection(walletId);

      if (!wallet) {
        return new ApiResponse<boolean>(
          404,
          `Wallet with ID ${walletId} not found`,
          false,
        );
      }

      // Get the appropriate strategy
      const strategy = this.getStrategy(wallet.type);

      // Disconnect the wallet using the strategy
      return strategy.disconnect(walletId, operatorId);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      return new ApiResponse<boolean>(
        500,
        `Error disconnecting wallet: ${error.message}`,
        false,
      );
    }
  }

  /**
   * Validate a wallet
   */
  async validateWallet(
    walletId: string,
    validationData: Record<string, any>,
  ): Promise<ApiResponse<boolean>> {
    try {
      // Get the wallet to determine its type
      const wallet =
        await this.walletConnectionService.getWalletConnection(walletId);

      if (!wallet) {
        return new ApiResponse<boolean>(
          404,
          `Wallet with ID ${walletId} not found`,
          false,
        );
      }

      // Get the appropriate strategy
      const strategy = this.getStrategy(wallet.type);

      // Validate the wallet using the strategy
      return strategy.validate(walletId, validationData);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      return new ApiResponse<boolean>(
        500,
        `Error validating wallet: ${error.message}`,
        false,
      );
    }
  }

  /**
   * Get a specific wallet
   */
  async getWallet(
    walletId: string,
    operatorId: string,
  ): Promise<WalletConnection | null> {
    const wallet = await this.walletModel.findOne({
      _id: walletId,
      operatorId,
    });

    if (!wallet) {
      return null;
    }

    return {
      id: wallet._id.toString(),
      type: wallet.type,
      address: wallet.address,
      connectedAt: wallet.connectedAt,
      metadata: wallet.metadata,
    };
  }

  /**
   * Get all wallets for an operator
   */
  async getWalletsForOperator(
    operatorId: string,
  ): Promise<ApiResponse<WalletConnectionResponse[]>> {
    try {
      const wallets =
        await this.walletConnectionService.getWalletsForOperator(operatorId);

      return new ApiResponse<WalletConnectionResponse[]>(
        200,
        'Wallets retrieved successfully',
        wallets.map((wallet) => ({ wallet })),
      );
    } catch (error) {
      return new ApiResponse<WalletConnectionResponse[]>(
        500,
        `Error retrieving wallets: ${error.message}`,
        [],
      );
    }
  }

  /**
   * Get wallet events
   */
  async getWalletEvents(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<any>> {
    try {
      // Verify the wallet belongs to the operator
      const wallet = await this.getWallet(walletId, operatorId);

      if (!wallet) {
        return new ApiResponse(
          404,
          `Wallet with ID ${walletId} not found`,
          null,
        );
      }

      const events =
        await this.walletConnectionService.getWalletEvents(walletId);

      return new ApiResponse(
        200,
        'Wallet events retrieved successfully',
        events,
      );
    } catch (error) {
      return new ApiResponse(
        500,
        `Error retrieving wallet events: ${error.message}`,
        null,
      );
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(
    walletId: string,
    operatorId: string,
  ): Promise<ApiResponse<any>> {
    try {
      // Verify the wallet belongs to the operator
      const wallet = await this.getWallet(walletId, operatorId);

      if (!wallet) {
        return new ApiResponse(
          404,
          `Wallet with ID ${walletId} not found`,
          null,
        );
      }

      // Get the appropriate strategy
      const strategy = this.getStrategy(wallet.type);

      // Check if the strategy supports balance checking
      if (!strategy.getBalance) {
        return new ApiResponse(
          400,
          `Balance checking not supported for wallet type: ${wallet.type}`,
          null,
        );
      }

      // Get the balance using the strategy
      return strategy.getBalance(walletId);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      return new ApiResponse(
        500,
        `Error retrieving wallet balance: ${error.message}`,
        null,
      );
    }
  }
}
