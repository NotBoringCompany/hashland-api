import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NFT, NFTStatus } from '../schemas/nft.schema';

/**
 * Service for managing NFTs in the auction system
 */
@Injectable()
export class NFTService {
  private readonly logger = new Logger(NFTService.name);

  constructor(@InjectModel(NFT.name) private nftModel: Model<NFT>) {}

  /**
   * Create a new NFT
   */
  async createNFT(nftData: {
    title: string;
    description: string;
    imageUrl: string;
    metadata: {
      attributes: Array<{ trait_type: string; value: string | number }>;
      rarity: string;
    };
  }): Promise<NFT> {
    try {
      const nft = new this.nftModel({
        ...nftData,
        status: NFTStatus.DRAFT,
      });

      await nft.save();

      this.logger.log(`Created NFT: ${nft._id} - ${nft.title}`);
      return nft;
    } catch (error) {
      this.logger.error(
        `(createNFT) Error creating NFT: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create NFT');
    }
  }

  /**
   * Get NFT by ID
   */
  async getNFTById(nftId: Types.ObjectId): Promise<NFT> {
    try {
      const nft = await this.nftModel.findById(nftId);
      if (!nft) {
        throw new NotFoundException('NFT not found');
      }
      return nft;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `(getNFTById) Error getting NFT ${nftId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get NFT');
    }
  }

  /**
   * Get all NFTs with pagination and filtering
   */
  async getNFTs(
    page = 1,
    limit = 20,
    status?: NFTStatus,
    rarity?: string,
  ): Promise<{
    nfts: NFT[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const filter: any = {};

      if (status) {
        filter.status = status;
      }
      if (rarity) {
        filter['metadata.rarity'] = rarity;
      }

      const skip = (page - 1) * limit;

      const [nfts, total] = await Promise.all([
        this.nftModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.nftModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        nfts,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `(getNFTs) Error getting NFTs: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get NFTs');
    }
  }

  /**
   * Update NFT
   */
  async updateNFT(
    nftId: Types.ObjectId,
    updateData: Partial<{
      title: string;
      description: string;
      imageUrl: string;
      metadata: {
        attributes: Array<{ trait_type: string; value: string | number }>;
        rarity: string;
      };
      status: NFTStatus;
    }>,
  ): Promise<NFT> {
    try {
      const nft = await this.nftModel.findByIdAndUpdate(
        nftId,
        { $set: updateData },
        { new: true },
      );

      if (!nft) {
        throw new NotFoundException('NFT not found');
      }

      this.logger.log(`Updated NFT: ${nft._id} - ${nft.title}`);
      return nft;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `(updateNFT) Error updating NFT ${nftId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update NFT');
    }
  }

  /**
   * Delete NFT
   */
  async deleteNFT(nftId: Types.ObjectId): Promise<void> {
    try {
      const result = await this.nftModel.findByIdAndDelete(nftId);
      if (!result) {
        throw new NotFoundException('NFT not found');
      }

      this.logger.log(`Deleted NFT: ${nftId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `(deleteNFT) Error deleting NFT ${nftId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete NFT');
    }
  }

  /**
   * Get NFTs by status
   */
  async getNFTsByStatus(status: NFTStatus): Promise<NFT[]> {
    try {
      return await this.nftModel.find({ status }).sort({ createdAt: -1 });
    } catch (error) {
      this.logger.error(
        `(getNFTsByStatus) Error getting NFTs by status ${status}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get NFTs by status');
    }
  }

  /**
   * Update NFT status
   */
  async updateNFTStatus(
    nftId: Types.ObjectId,
    status: NFTStatus,
  ): Promise<NFT> {
    try {
      const nft = await this.nftModel.findByIdAndUpdate(
        nftId,
        { $set: { status } },
        { new: true },
      );

      if (!nft) {
        throw new NotFoundException('NFT not found');
      }

      this.logger.log(`Updated NFT status: ${nft._id} to ${status}`);
      return nft;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `(updateNFTStatus) Error updating NFT status ${nftId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update NFT status');
    }
  }
}
