import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// Schemas
import { Auction, AuctionStatus } from '../schemas/auction.schema';
import {
  AuctionWhitelist,
  WhitelistStatus,
} from '../schemas/auction-whitelist.schema';
import { Bid, BidStatus, BidType } from '../schemas/bid.schema';
import {
  AuctionHistory,
  AuctionAction,
} from '../schemas/auction-history.schema';
import { NFT, NFTStatus } from '../schemas/nft.schema';
import { HashTransactionCategory } from 'src/operators/schemas/hash-transaction.schema';

// External services
import { OperatorService } from 'src/operators/operator.service';

// Queue service
import { BidQueueService } from '../services/bid-queue.service';

/**
 * Service for managing auctions in the auction system
 */
@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(AuctionWhitelist.name)
    private whitelistModel: Model<AuctionWhitelist>,
    @InjectModel(Bid.name) private bidModel: Model<Bid>,
    @InjectModel(AuctionHistory.name)
    private historyModel: Model<AuctionHistory>,
    @InjectModel(NFT.name) private nftModel: Model<NFT>,
    private operatorService: OperatorService,
    private bidQueueService: BidQueueService,
  ) {}

  /**
   * Create a new auction
   */
  async createAuction(auctionData: {
    nftId: Types.ObjectId;
    title: string;
    description: string;
    startingPrice: number;
    whitelistConfig: {
      maxParticipants: number;
      entryFee: number;
      startTime: Date;
      endTime: Date;
    };
    auctionConfig: {
      startTime: Date;
      endTime: Date;
      minBidIncrement: number;
      reservePrice?: number;
      buyNowPrice?: number;
    };
  }): Promise<Auction> {
    try {
      // Validate NFT exists and is available
      const nft = await this.nftModel.findById(auctionData.nftId);
      if (!nft) {
        throw new NotFoundException('NFT not found');
      }
      if (nft.status !== NFTStatus.ACTIVE) {
        throw new BadRequestException('NFT is not available for auction');
      }

      // Validate dates
      if (
        auctionData.whitelistConfig.startTime >=
        auctionData.whitelistConfig.endTime
      ) {
        throw new BadRequestException(
          'Whitelist start time must be before end time',
        );
      }
      if (
        auctionData.auctionConfig.startTime >= auctionData.auctionConfig.endTime
      ) {
        throw new BadRequestException(
          'Auction start time must be before end time',
        );
      }
      if (
        auctionData.whitelistConfig.endTime >
        auctionData.auctionConfig.startTime
      ) {
        throw new BadRequestException(
          'Whitelist must end before auction starts',
        );
      }

      const auction = new this.auctionModel({
        ...auctionData,
        whitelistConfig: {
          ...auctionData.whitelistConfig,
          isActive: false,
        },
        currentHighestBid: auctionData.startingPrice,
        status: AuctionStatus.DRAFT,
      });

      await auction.save();

      this.logger.log(`Created auction: ${auction._id} - ${auction.title}`);
      return auction;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `(createAuction) Error creating auction: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create auction');
    }
  }

  /**
   * Get auction by ID with populated data
   */
  async getAuctionById(auctionId: Types.ObjectId): Promise<Auction> {
    try {
      let query = this.auctionModel.findById(auctionId);

      query = query.populate('nft');
      query = query.populate('currentWinner', '_id username');

      const auction = await query.exec();
      if (!auction) {
        throw new NotFoundException('Auction not found');
      }
      return auction;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `(getAuctionById) Error getting auction ${auctionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get auction');
    }
  }

  /**
   * Get all auctions with pagination and filtering
   */
  async getAuctions(
    page = 1,
    limit = 20,
    status?: AuctionStatus,
    filters?: {
      nftId?: string;
      currentWinner?: string;
      titleSearch?: string;
      descriptionSearch?: string;
      minStartingPrice?: number;
      maxStartingPrice?: number;
      minCurrentBid?: number;
      maxCurrentBid?: number;
      auctionStartAfter?: string;
      auctionStartBefore?: string;
      auctionEndAfter?: string;
      auctionEndBefore?: string;
      createdAfter?: string;
      createdBefore?: string;
      minTotalBids?: number;
      maxTotalBids?: number;
      minTotalParticipants?: number;
      maxTotalParticipants?: number;
      populateNFT?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    auctions: Auction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      if (filters) {
        // NFT and winner filters
        if (filters.nftId) {
          filter.nftId = new Types.ObjectId(filters.nftId);
        }
        if (filters.currentWinner) {
          filter.currentWinner = new Types.ObjectId(filters.currentWinner);
        }

        // Text search filters
        if (filters.titleSearch) {
          filter.title = { $regex: filters.titleSearch, $options: 'i' };
        }
        if (filters.descriptionSearch) {
          filter.description = {
            $regex: filters.descriptionSearch,
            $options: 'i',
          };
        }

        // Price range filters
        if (
          filters.minStartingPrice !== undefined ||
          filters.maxStartingPrice !== undefined
        ) {
          filter.startingPrice = {};
          if (filters.minStartingPrice !== undefined) {
            filter.startingPrice.$gte = filters.minStartingPrice;
          }
          if (filters.maxStartingPrice !== undefined) {
            filter.startingPrice.$lte = filters.maxStartingPrice;
          }
        }

        if (
          filters.minCurrentBid !== undefined ||
          filters.maxCurrentBid !== undefined
        ) {
          filter.currentHighestBid = {};
          if (filters.minCurrentBid !== undefined) {
            filter.currentHighestBid.$gte = filters.minCurrentBid;
          }
          if (filters.maxCurrentBid !== undefined) {
            filter.currentHighestBid.$lte = filters.maxCurrentBid;
          }
        }

        // Date range filters for auction times
        if (filters.auctionStartAfter || filters.auctionStartBefore) {
          filter['auctionConfig.startTime'] = {};
          if (filters.auctionStartAfter) {
            filter['auctionConfig.startTime'].$gte = new Date(
              filters.auctionStartAfter,
            );
          }
          if (filters.auctionStartBefore) {
            filter['auctionConfig.startTime'].$lte = new Date(
              filters.auctionStartBefore,
            );
          }
        }

        if (filters.auctionEndAfter || filters.auctionEndBefore) {
          filter['auctionConfig.endTime'] = {};
          if (filters.auctionEndAfter) {
            filter['auctionConfig.endTime'].$gte = new Date(
              filters.auctionEndAfter,
            );
          }
          if (filters.auctionEndBefore) {
            filter['auctionConfig.endTime'].$lte = new Date(
              filters.auctionEndBefore,
            );
          }
        }

        // Date range filters for creation time
        if (filters.createdAfter || filters.createdBefore) {
          filter.createdAt = {};
          if (filters.createdAfter) {
            filter.createdAt.$gte = new Date(filters.createdAfter);
          }
          if (filters.createdBefore) {
            filter.createdAt.$lte = new Date(filters.createdBefore);
          }
        }

        // Bid and participant count filters
        if (
          filters.minTotalBids !== undefined ||
          filters.maxTotalBids !== undefined
        ) {
          filter.totalBids = {};
          if (filters.minTotalBids !== undefined) {
            filter.totalBids.$gte = filters.minTotalBids;
          }
          if (filters.maxTotalBids !== undefined) {
            filter.totalBids.$lte = filters.maxTotalBids;
          }
        }

        if (
          filters.minTotalParticipants !== undefined ||
          filters.maxTotalParticipants !== undefined
        ) {
          filter.totalParticipants = {};
          if (filters.minTotalParticipants !== undefined) {
            filter.totalParticipants.$gte = filters.minTotalParticipants;
          }
          if (filters.maxTotalParticipants !== undefined) {
            filter.totalParticipants.$lte = filters.maxTotalParticipants;
          }
        }
      }

      const skip = (page - 1) * limit;

      // Build sort object
      const sortField = filters?.sortBy || 'createdAt';
      const sortDirection = filters?.sortOrder === 'asc' ? 1 : -1;
      const sort: any = {};
      sort[sortField] = sortDirection;

      let query = this.auctionModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      // Conditional population
      if (filters?.populateNFT) {
        query = query.populate('nft');
      }
      query = query.populate('currentWinner', '_id username');

      const [auctions, total] = await Promise.all([
        query.exec(),
        this.auctionModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        auctions,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `(getAuctions) Error getting auctions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get auctions');
    }
  }

  /**
   * Join auction whitelist
   */
  async joinWhitelist(
    auctionId: Types.ObjectId,
    operatorId: Types.ObjectId,
  ): Promise<AuctionWhitelist> {
    try {
      // Get auction
      const auction = await this.getAuctionById(auctionId);

      // Validate whitelist is open
      if (auction.status !== AuctionStatus.WHITELIST_OPEN) {
        throw new BadRequestException('Whitelist is not open');
      }

      const now = new Date();
      if (
        now < auction.whitelistConfig.startTime ||
        now > auction.whitelistConfig.endTime
      ) {
        throw new BadRequestException('Whitelist period is not active');
      }

      // Check if already whitelisted
      const existingEntry = await this.whitelistModel.findOne({
        auctionId,
        operatorId,
      });
      if (existingEntry) {
        throw new BadRequestException('Already whitelisted for this auction');
      }

      // Check whitelist capacity
      const currentCount = await this.whitelistModel.countDocuments({
        auctionId,
      });
      if (currentCount >= auction.whitelistConfig.maxParticipants) {
        throw new BadRequestException('Whitelist is full');
      }

      // Process payment
      const paymentResult = await this.operatorService.deductHASH(
        operatorId,
        auction.whitelistConfig.entryFee,
        HashTransactionCategory.WHITELIST_PAYMENT,
        `Whitelist entry for auction ${auctionId}`,
        auctionId,
        'auction',
        { auctionId: auctionId.toString() },
      );

      if (!paymentResult.success) {
        throw new BadRequestException(paymentResult.error || 'Payment failed');
      }

      // Create whitelist entry
      const whitelistEntry = new this.whitelistModel({
        auctionId,
        operatorId,
        entryFeePaid: auction.whitelistConfig.entryFee,
        paymentTransactionId: paymentResult.transaction?._id.toString() || '',
        status: WhitelistStatus.CONFIRMED,
      });

      await whitelistEntry.save();

      // Record history
      await this.recordHistory(
        auctionId,
        operatorId,
        AuctionAction.WHITELIST_JOINED,
        { amount: auction.whitelistConfig.entryFee },
      );

      this.logger.log(
        `Operator ${operatorId} joined whitelist for auction ${auctionId}`,
      );
      return whitelistEntry;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `(joinWhitelist) Error joining whitelist: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to join whitelist');
    }
  }

  /**
   * Place a bid on an auction
   */
  async placeBid(
    auctionId: Types.ObjectId,
    bidderId: Types.ObjectId,
    amount: number,
    bidType: BidType = BidType.REGULAR,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<Bid> {
    try {
      // Get auction
      const auction = await this.getAuctionById(auctionId);

      // Validate auction is active
      if (auction.status !== AuctionStatus.AUCTION_ACTIVE) {
        throw new BadRequestException('Auction is not active');
      }

      const now = new Date();
      if (
        now < auction.auctionConfig.startTime ||
        now > auction.auctionConfig.endTime
      ) {
        throw new BadRequestException('Auction period is not active');
      }

      // Check if bidder is whitelisted
      const whitelistEntry = await this.whitelistModel.findOne({
        auctionId,
        operatorId: bidderId,
        status: WhitelistStatus.CONFIRMED,
      });
      if (!whitelistEntry) {
        throw new BadRequestException('Not whitelisted for this auction');
      }

      // Validate bid amount
      const minBidAmount =
        auction.currentHighestBid + auction.auctionConfig.minBidIncrement;
      if (bidType === BidType.REGULAR && amount < minBidAmount) {
        throw new BadRequestException(
          `Bid must be at least ${minBidAmount} HASH`,
        );
      }

      if (bidType === BidType.BUY_NOW) {
        if (!auction.auctionConfig.buyNowPrice) {
          throw new BadRequestException(
            'Buy now is not available for this auction',
          );
        }
        if (amount !== auction.auctionConfig.buyNowPrice) {
          throw new BadRequestException(
            'Buy now amount must match the set price',
          );
        }
      }

      // Hold the bid amount
      const holdResult = await this.operatorService.holdHASH(
        bidderId,
        amount,
        HashTransactionCategory.BID_HOLD,
        `Bid hold for auction ${auctionId}`,
        auctionId,
        'auction',
        { auctionId: auctionId.toString(), amount },
      );

      if (!holdResult.success) {
        throw new BadRequestException(
          holdResult.error || 'Failed to hold bid amount',
        );
      }

      // Create bid
      const bid = new this.bidModel({
        auctionId,
        bidderId,
        amount,
        bidType,
        status: BidStatus.CONFIRMED,
        transactionId: holdResult.transaction?._id.toString() || '',
        metadata: {
          ...metadata,
          timestamp: new Date(),
        },
      });

      await bid.save();

      // Update auction if this is the highest bid
      if (amount > auction.currentHighestBid) {
        // Mark previous winner's bid as outbid
        if (auction.currentWinner) {
          await this.bidModel.updateMany(
            {
              auctionId,
              bidderId: auction.currentWinner,
              status: BidStatus.WINNING,
            },
            { $set: { status: BidStatus.OUTBID } },
          );

          // Record outbid history
          await this.recordHistory(
            auctionId,
            auction.currentWinner,
            AuctionAction.BID_OUTBID,
            { amount: auction.currentHighestBid, newAmount: amount },
          );
        }

        // Update auction
        await this.auctionModel.findByIdAndUpdate(auctionId, {
          $set: {
            currentHighestBid: amount,
            currentWinner: bidderId,
          },
          $inc: {
            totalBids: 1,
          },
        });

        // Mark this bid as winning
        bid.status = BidStatus.WINNING;
        await bid.save();

        // Record bid history
        await this.recordHistory(
          auctionId,
          bidderId,
          AuctionAction.BID_PLACED,
          { amount, previousAmount: auction.currentHighestBid },
        );

        // If buy now, end auction immediately
        if (bidType === BidType.BUY_NOW) {
          await this.endAuction(auctionId);
        }
      }

      this.logger.log(`Bid placed: ${bid._id} - ${amount} HASH by ${bidderId}`);
      return bid;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `(placeBid) Error placing bid: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to place bid');
    }
  }

  /**
   * End an auction
   */
  async endAuction(auctionId: Types.ObjectId): Promise<Auction> {
    try {
      const auction = await this.getAuctionById(auctionId);

      if (auction.status === AuctionStatus.ENDED) {
        return auction;
      }

      // Update auction status
      await this.auctionModel.findByIdAndUpdate(auctionId, {
        $set: { status: AuctionStatus.ENDED },
      });

      // Process winner if there is one
      if (auction.currentWinner) {
        // Record auction won
        await this.recordHistory(
          auctionId,
          auction.currentWinner,
          AuctionAction.AUCTION_WON,
          { amount: auction.currentHighestBid },
        );

        // Transfer HASH from hold to deducted for winner
        // This would be handled by the payment processing system
      }

      // Record auction ended
      await this.recordHistory(
        auctionId,
        auction.currentWinner || new Types.ObjectId(),
        AuctionAction.AUCTION_ENDED,
        { amount: auction.currentHighestBid },
      );

      this.logger.log(`Auction ended: ${auctionId}`);
      return await this.getAuctionById(auctionId);
    } catch (error) {
      this.logger.error(
        `(endAuction) Error ending auction: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to end auction');
    }
  }

  /**
   * Get auction history
   */
  async getAuctionHistory(
    auctionId: Types.ObjectId,
    page = 1,
    limit = 50,
    filters?: {
      action?: string;
      operatorId?: string;
      timestampAfter?: string;
      timestampBefore?: string;
      minAmount?: number;
      maxAmount?: number;
      createdAfter?: string;
      createdBefore?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      populateAuction?: boolean;
      populateOperator?: boolean;
    },
  ): Promise<{
    history: AuctionHistory[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const filter: any = { auctionId };

      if (filters) {
        // Action filter
        if (filters.action) {
          filter.action = filters.action;
        }

        // Operator filter
        if (filters.operatorId) {
          filter.operatorId = new Types.ObjectId(filters.operatorId);
        }

        // Timestamp range filters
        if (filters.timestampAfter || filters.timestampBefore) {
          filter.timestamp = {};
          if (filters.timestampAfter) {
            filter.timestamp.$gte = new Date(filters.timestampAfter);
          }
          if (filters.timestampBefore) {
            filter.timestamp.$lte = new Date(filters.timestampBefore);
          }
        }

        // Amount range filters (for bid-related actions)
        if (
          filters.minAmount !== undefined ||
          filters.maxAmount !== undefined
        ) {
          filter['details.amount'] = {};
          if (filters.minAmount !== undefined) {
            filter['details.amount'].$gte = filters.minAmount;
          }
          if (filters.maxAmount !== undefined) {
            filter['details.amount'].$lte = filters.maxAmount;
          }
        }

        // Created date range filters
        if (filters.createdAfter || filters.createdBefore) {
          filter.createdAt = {};
          if (filters.createdAfter) {
            filter.createdAt.$gte = new Date(filters.createdAfter);
          }
          if (filters.createdBefore) {
            filter.createdAt.$lte = new Date(filters.createdBefore);
          }
        }
      }

      const skip = (page - 1) * limit;

      // Build sort object
      const sortField = filters?.sortBy || 'timestamp';
      const sortDirection = filters?.sortOrder === 'asc' ? 1 : -1;
      const sort: any = {};
      sort[sortField] = sortDirection;

      let query = this.historyModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      // Conditional population
      if (filters?.populateAuction) {
        query = query.populate('auction');
      }
      if (filters?.populateOperator !== false) {
        query = query.populate('operator', '_id username');
      }

      const [history, total] = await Promise.all([
        query.exec(),
        this.historyModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        history,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `(getAuctionHistory) Error getting auction history: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get auction history');
    }
  }

  /**
   * Record auction history
   */
  private async recordHistory(
    auctionId: Types.ObjectId,
    operatorId: Types.ObjectId,
    action: AuctionAction,
    details?: any,
  ): Promise<void> {
    try {
      const history = new this.historyModel({
        auctionId,
        operatorId,
        action,
        details: details || {},
      });

      await history.save();
    } catch (error) {
      this.logger.error(
        `(recordHistory) Error recording history: ${error.message}`,
        error.stack,
      );
      // Don't throw error for history recording failures
    }
  }

  /**
   * Place a bid via queue system for high-frequency handling
   */
  async placeBidQueued(
    auctionId: Types.ObjectId,
    bidderId: Types.ObjectId,
    amount: number,
    bidType: BidType = BidType.REGULAR,
    metadata?: any,
  ): Promise<{ jobId: string; message: string }> {
    try {
      // Add bid to queue for processing
      const job = await this.bidQueueService.addBidToQueue(
        auctionId.toString(),
        bidderId.toString(),
        amount,
        bidType,
        metadata,
      );

      this.logger.log(
        `Bid queued: job ${job.id} (auction: ${auctionId}, bidder: ${bidderId}, amount: ${amount})`,
      );

      return {
        jobId: job.id?.toString() || 'unknown',
        message: 'Bid queued for processing',
      };
    } catch (error) {
      this.logger.error(`Error queueing bid: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to queue bid');
    }
  }

  /**
   * Check if auction is in high-frequency mode (ending soon or high activity)
   */
  async shouldUseQueue(auctionId: Types.ObjectId): Promise<boolean> {
    try {
      const auction = await this.getAuctionById(auctionId);
      const now = new Date();
      const endTime = auction.auctionConfig.endTime;
      const timeUntilEnd = endTime.getTime() - now.getTime();

      // Use queue if auction ends within 30 minutes
      const thirtyMinutes = 30 * 60 * 1000;
      if (timeUntilEnd <= thirtyMinutes && timeUntilEnd > 0) {
        return true;
      }

      // Use queue if auction has high bid activity (more than 50 bids)
      if (auction.totalBids > 50) {
        return true;
      }

      // Use queue for buy-now bids (always high priority)
      return false;
    } catch (error) {
      this.logger.error(`Error checking queue usage: ${error.message}`);
      return false; // Default to direct processing
    }
  }
}
