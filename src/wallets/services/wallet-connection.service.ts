import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WalletConnection } from '../interfaces/wallet.interface';
import { Wallet } from '../schemas/wallet.schema';
import { Operator } from '../../operators/schemas/operator.schema';
import {
  WalletConnectionEvent,
  WalletConnectionStatus,
} from '../interfaces/wallet-connection-types';

@Injectable()
export class WalletConnectionService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator & Document>,
    @InjectModel('WalletConnectionEvent')
    private walletEventModel: Model<WalletConnectionEvent>,
  ) {}

  /**
   * Save a new wallet connection
   */
  async saveWalletConnection(
    walletConnection: WalletConnection,
    operatorId: string,
  ): Promise<WalletConnection> {
    // Check if operator exists
    const operator = await this.operatorModel.findById(new Types.ObjectId(operatorId));
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${operatorId} not found`);
    }

    // Create new wallet document
    const newWallet = new this.walletModel({
      ...walletConnection,
      operatorId: new Types.ObjectId(operatorId),
    });

    // Save wallet to database
    const savedWallet = await newWallet.save();

    // Update operator with the new wallet
    if (!operator.wallets) {
      operator.wallets = [];
    }

    // Add the wallet ID to the operator's wallets array
    operator.wallets.push(savedWallet._id as unknown as Types.ObjectId);
    await operator.save();

    // Log connection event
    await this.logWalletEvent({
      walletId: savedWallet._id.toString(),
      operatorId,
      eventType: 'connect',
      timestamp: new Date(),
      status: WalletConnectionStatus.CONNECTED,
      metadata: {
        walletType: walletConnection.type,
        address: walletConnection.address,
      },
    });

    return {
      id: savedWallet._id.toString(),
      type: savedWallet.type,
      address: savedWallet.address,
      connectedAt: savedWallet.connectedAt,
      metadata: savedWallet.metadata,
    };
  }

  /**
   * Find a wallet by its ID
   */
  async getWalletConnection(
    walletId: string,
  ): Promise<WalletConnection | null> {
    const wallet = await this.walletModel.findById(walletId);
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
   * Find a wallet by address and type for a specific operator
   */
  async findWalletByAddressAndType(
    address: string,
    type: string,
    operatorId: string,
  ): Promise<WalletConnection | null> {
    const wallet = await this.walletModel.findOne({
      address,
      type,
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
  async getWalletsForOperator(operatorId: string): Promise<WalletConnection[]> {
    const wallets = await this.walletModel.find({ operatorId });

    return wallets.map((wallet) => ({
      id: wallet._id.toString(),
      type: wallet.type,
      address: wallet.address,
      connectedAt: wallet.connectedAt,
      metadata: wallet.metadata,
    }));
  }

  /**
   * Remove a wallet connection
   */
  async removeWalletConnection(
    walletId: string,
    operatorId: string,
    walletType: string,
  ): Promise<boolean> {
    // Find and remove the wallet
    const wallet = await this.walletModel.findOneAndDelete({
      _id: new Types.ObjectId(walletId),
      operatorId,
      type: walletType,
    });

    if (!wallet) {
      return false;
    }

    // Update the operator document to remove the wallet reference
    await this.operatorModel.updateOne(
      { _id: new Types.ObjectId(operatorId) },
      { $pull: { wallets: new Types.ObjectId(walletId) } },
    );

    // Log disconnection event
    await this.logWalletEvent({
      walletId,
      operatorId,
      eventType: 'disconnect',
      timestamp: new Date(),
      status: WalletConnectionStatus.DISCONNECTED,
      metadata: {
        walletType,
        address: wallet.address,
      },
    });

    return true;
  }

  /**
   * Log wallet connection events
   */
  async logWalletEvent(event: WalletConnectionEvent): Promise<void> {
    const newEvent = new this.walletEventModel(event);
    await newEvent.save();
  }

  /**
   * Get wallet connection events for a specific wallet
   */
  async getWalletEvents(walletId: string): Promise<WalletConnectionEvent[]> {
    return this.walletEventModel.find({ walletId }).sort({ timestamp: -1 });
  }
}
