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
import { Auction, AuctionStatus } from './schemas/auction.schema';
import {
  AuctionWhitelist,
  WhitelistStatus,
} from './schemas/auction-whitelist.schema';
import { Bid, BidStatus, BidType } from './schemas/bid.schema';
import {
  AuctionHistory,
  AuctionAction,
} from './schemas/auction-history.schema';
import { NFT, NFTStatus } from './schemas/nft.schema';
import { HashTransactionCategory } from 'src/operators/schemas/hash-transaction.schema';

// External services
import { OperatorService } from 'src/operators/operator.service';

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
  async getAuctionById(
    auctionId: Types.ObjectId,
    populateNFT = true,
  ): Promise<Auction> {
    try {
      let query = this.auctionModel.findById(auctionId);

      if (populateNFT) {
        query = query.populate('nftId');
      }

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
    populateNFT = true,
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

      const skip = (page - 1) * limit;

      let query = this.auctionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      if (populateNFT) {
        query = query.populate('nftId');
      }

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
      const auction = await this.getAuctionById(auctionId, false);

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
      const auction = await this.getAuctionById(auctionId, false);

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
      const auction = await this.getAuctionById(auctionId, false);

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
      return await this.getAuctionById(auctionId, false);
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
  ): Promise<{
    history: AuctionHistory[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        this.historyModel
          .find({ auctionId })
          .populate('operatorId', 'username email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.historyModel.countDocuments({ auctionId }),
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
}
