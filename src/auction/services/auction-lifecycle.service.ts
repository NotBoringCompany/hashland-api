import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionService } from './auction.service';
import { AuctionNotificationService } from './auction-notification.service';
import { Auction, AuctionStatus } from '../schemas/auction.schema';
import { NFT, NFTStatus } from '../schemas/nft.schema';
import {
  AuctionHistory,
  AuctionAction,
} from '../schemas/auction-history.schema';

/**
 * Service for managing auction lifecycle and automated state transitions
 */
@Injectable()
export class AuctionLifecycleService {
  private readonly logger = new Logger(AuctionLifecycleService.name);

  constructor(
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(NFT.name) private nftModel: Model<NFT>,
    @InjectModel(AuctionHistory.name)
    private historyModel: Model<AuctionHistory>,
    private auctionService: AuctionService,
    private notificationService: AuctionNotificationService,
  ) {}

  /**
   * Process auction lifecycle transitions every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processAuctionLifecycle(): Promise<void> {
    try {
      this.logger.log('Processing auction lifecycle transitions...');

      await Promise.all([
        this.openWhitelists(),
        this.closeWhitelists(),
        this.startAuctions(),
        this.endAuctions(),
        this.sendEndingWarnings(),
      ]);

      this.logger.log('Auction lifecycle processing completed');
    } catch (error) {
      this.logger.error(
        `Error processing auction lifecycle: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Open whitelists that should be active now
   */
  private async openWhitelists(): Promise<void> {
    try {
      const now = new Date();
      const auctionsToOpen = await this.auctionModel.find({
        status: AuctionStatus.DRAFT,
        'whitelistConfig.startTime': { $lte: now },
        'whitelistConfig.endTime': { $gt: now },
      });

      for (const auction of auctionsToOpen) {
        await this.transitionToWhitelistOpen(auction);
      }

      if (auctionsToOpen.length > 0) {
        this.logger.log(`Opened ${auctionsToOpen.length} whitelists`);
      }
    } catch (error) {
      this.logger.error(`Error opening whitelists: ${error.message}`);
    }
  }

  /**
   * Close whitelists that have ended
   */
  private async closeWhitelists(): Promise<void> {
    try {
      const now = new Date();
      const auctionsToClose = await this.auctionModel.find({
        status: AuctionStatus.WHITELIST_OPEN,
        'whitelistConfig.endTime': { $lte: now },
      });

      for (const auction of auctionsToClose) {
        await this.transitionToWhitelistClosed(auction);
      }

      if (auctionsToClose.length > 0) {
        this.logger.log(`Closed ${auctionsToClose.length} whitelists`);
      }
    } catch (error) {
      this.logger.error(`Error closing whitelists: ${error.message}`);
    }
  }

  /**
   * Start auctions that should be active now
   */
  private async startAuctions(): Promise<void> {
    try {
      const now = new Date();
      const auctionsToStart = await this.auctionModel.find({
        status: AuctionStatus.WHITELIST_CLOSED,
        'auctionConfig.startTime': { $lte: now },
        'auctionConfig.endTime': { $gt: now },
      });

      for (const auction of auctionsToStart) {
        await this.transitionToAuctionActive(auction);
      }

      if (auctionsToStart.length > 0) {
        this.logger.log(`Started ${auctionsToStart.length} auctions`);
      }
    } catch (error) {
      this.logger.error(`Error starting auctions: ${error.message}`);
    }
  }

  /**
   * End auctions that have finished
   */
  private async endAuctions(): Promise<void> {
    try {
      const now = new Date();
      const auctionsToEnd = await this.auctionModel.find({
        status: AuctionStatus.AUCTION_ACTIVE,
        'auctionConfig.endTime': { $lte: now },
      });

      for (const auction of auctionsToEnd) {
        await this.transitionToAuctionEnded(auction);
      }

      if (auctionsToEnd.length > 0) {
        this.logger.log(`Ended ${auctionsToEnd.length} auctions`);
      }
    } catch (error) {
      this.logger.error(`Error ending auctions: ${error.message}`);
    }
  }

  /**
   * Send ending warnings for auctions ending soon
   */
  private async sendEndingWarnings(): Promise<void> {
    try {
      const now = new Date();
      const warningTimes = [30, 15, 5, 1]; // minutes before end

      for (const minutes of warningTimes) {
        const warningTime = new Date(now.getTime() + minutes * 60 * 1000);
        const auctionsEndingSoon = await this.auctionModel.find({
          status: AuctionStatus.AUCTION_ACTIVE,
          'auctionConfig.endTime': {
            $gte: warningTime,
            $lte: new Date(warningTime.getTime() + 60 * 1000), // 1-minute window
          },
        });

        for (const auction of auctionsEndingSoon) {
          await this.sendEndingWarning(auction, minutes);
        }
      }
    } catch (error) {
      this.logger.error(`Error sending ending warnings: ${error.message}`);
    }
  }

  /**
   * Transition auction to whitelist open status
   */
  private async transitionToWhitelistOpen(auction: Auction): Promise<void> {
    try {
      await this.auctionModel.findByIdAndUpdate(auction._id, {
        $set: {
          status: AuctionStatus.WHITELIST_OPEN,
          'whitelistConfig.isActive': true,
        },
      });

      await this.recordLifecycleEvent(
        auction._id,
        AuctionAction.WHITELIST_OPENED,
        {
          previousStatus: auction.status,
          newStatus: AuctionStatus.WHITELIST_OPEN,
          timestamp: new Date(),
        },
      );

      // Send notifications
      await this.notificationService.notifyWhitelistOpened(
        auction._id.toString(),
        auction,
      );

      this.logger.log(`Whitelist opened for auction: ${auction._id}`);
    } catch (error) {
      this.logger.error(
        `Error transitioning auction ${auction._id} to whitelist open: ${error.message}`,
      );
    }
  }

  /**
   * Transition auction to whitelist closed status
   */
  private async transitionToWhitelistClosed(auction: Auction): Promise<void> {
    try {
      await this.auctionModel.findByIdAndUpdate(auction._id, {
        $set: {
          status: AuctionStatus.WHITELIST_CLOSED,
          'whitelistConfig.isActive': false,
        },
      });

      await this.recordLifecycleEvent(
        auction._id,
        AuctionAction.WHITELIST_CLOSED,
        {
          previousStatus: auction.status,
          newStatus: AuctionStatus.WHITELIST_CLOSED,
          timestamp: new Date(),
        },
      );

      // Send notifications
      await this.notificationService.notifyWhitelistClosed(
        auction._id.toString(),
        auction,
      );

      this.logger.log(`Whitelist closed for auction: ${auction._id}`);
    } catch (error) {
      this.logger.error(
        `Error transitioning auction ${auction._id} to whitelist closed: ${error.message}`,
      );
    }
  }

  /**
   * Transition auction to active status
   */
  private async transitionToAuctionActive(auction: Auction): Promise<void> {
    try {
      // Update NFT status to in auction
      await this.nftModel.findByIdAndUpdate(auction.nftId, {
        $set: { status: NFTStatus.IN_AUCTION },
      });

      await this.auctionModel.findByIdAndUpdate(auction._id, {
        $set: { status: AuctionStatus.AUCTION_ACTIVE },
      });

      await this.recordLifecycleEvent(
        auction._id,
        AuctionAction.AUCTION_STARTED,
        {
          previousStatus: auction.status,
          newStatus: AuctionStatus.AUCTION_ACTIVE,
          timestamp: new Date(),
        },
      );

      // Send notifications
      await this.notificationService.notifyAuctionStarted(
        auction._id.toString(),
        auction,
      );

      this.logger.log(`Auction started: ${auction._id}`);
    } catch (error) {
      this.logger.error(
        `Error transitioning auction ${auction._id} to active: ${error.message}`,
      );
    }
  }

  /**
   * Transition auction to ended status
   */
  private async transitionToAuctionEnded(auction: Auction): Promise<void> {
    try {
      // End the auction using the auction service
      await this.auctionService.endAuction(auction._id);

      // Update NFT status based on auction result
      const nftStatus = auction.currentWinner
        ? NFTStatus.SOLD
        : NFTStatus.ACTIVE;

      await this.nftModel.findByIdAndUpdate(auction.nftId, {
        $set: { status: nftStatus },
      });

      await this.recordLifecycleEvent(
        auction._id,
        AuctionAction.AUCTION_ENDED,
        {
          previousStatus: auction.status,
          newStatus: AuctionStatus.ENDED,
          winner: auction.currentWinner,
          finalPrice: auction.currentHighestBid,
          timestamp: new Date(),
        },
      );

      // Send notifications
      await this.notificationService.notifyAuctionEnded(
        auction._id.toString(),
        auction,
      );

      this.logger.log(
        `Auction ended: ${auction._id} (Winner: ${auction.currentWinner}, Price: ${auction.currentHighestBid})`,
      );
    } catch (error) {
      this.logger.error(
        `Error transitioning auction ${auction._id} to ended: ${error.message}`,
      );
    }
  }

  /**
   * Send ending warning notification
   */
  private async sendEndingWarning(
    auction: Auction,
    minutesLeft: number,
  ): Promise<void> {
    try {
      await this.notificationService.notifyAuctionEndingSoon(
        auction._id.toString(),
        minutesLeft,
      );

      this.logger.log(
        `Sent ending warning for auction ${auction._id}: ${minutesLeft} minutes left`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending ending warning for auction ${auction._id}: ${error.message}`,
      );
    }
  }

  /**
   * Record lifecycle event in history
   */
  private async recordLifecycleEvent(
    auctionId: Types.ObjectId,
    action: AuctionAction,
    details: any,
  ): Promise<void> {
    try {
      const history = new this.historyModel({
        auctionId,
        operatorId: null, // System action
        action,
        details,
      });

      await history.save();
    } catch (error) {
      this.logger.error(
        `Error recording lifecycle event: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger auction state transition
   */
  async triggerStateTransition(auctionId: string): Promise<{
    success: boolean;
    message: string;
    newStatus?: AuctionStatus;
  }> {
    try {
      const auction = await this.auctionModel.findById(auctionId);
      if (!auction) {
        return { success: false, message: 'Auction not found' };
      }

      const now = new Date();
      let transitioned = false;
      let newStatus: AuctionStatus | undefined;

      // Check what transition should happen
      if (
        auction.status === AuctionStatus.DRAFT &&
        now >= auction.whitelistConfig.startTime &&
        now < auction.whitelistConfig.endTime
      ) {
        await this.transitionToWhitelistOpen(auction);
        newStatus = AuctionStatus.WHITELIST_OPEN;
        transitioned = true;
      } else if (
        auction.status === AuctionStatus.WHITELIST_OPEN &&
        now >= auction.whitelistConfig.endTime
      ) {
        await this.transitionToWhitelistClosed(auction);
        newStatus = AuctionStatus.WHITELIST_CLOSED;
        transitioned = true;
      } else if (
        auction.status === AuctionStatus.WHITELIST_CLOSED &&
        now >= auction.auctionConfig.startTime &&
        now < auction.auctionConfig.endTime
      ) {
        await this.transitionToAuctionActive(auction);
        newStatus = AuctionStatus.AUCTION_ACTIVE;
        transitioned = true;
      } else if (
        auction.status === AuctionStatus.AUCTION_ACTIVE &&
        now >= auction.auctionConfig.endTime
      ) {
        await this.transitionToAuctionEnded(auction);
        newStatus = AuctionStatus.ENDED;
        transitioned = true;
      }

      if (transitioned) {
        return {
          success: true,
          message: `Auction transitioned to ${newStatus}`,
          newStatus,
        };
      } else {
        return {
          success: false,
          message: 'No transition needed at this time',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error triggering state transition: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to trigger transition: ${error.message}`,
      };
    }
  }

  /**
   * Get auction lifecycle status
   */
  async getLifecycleStatus(auctionId: string): Promise<{
    currentStatus: AuctionStatus;
    nextTransition?: {
      status: AuctionStatus;
      scheduledTime: Date;
      timeUntil: number;
    };
    timeline: Array<{
      status: AuctionStatus;
      time: Date;
      completed: boolean;
    }>;
  }> {
    try {
      const auction = await this.auctionModel.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      const now = new Date();
      const timeline = [
        {
          status: AuctionStatus.DRAFT,
          time: auction.createdAt,
          completed: true,
        },
        {
          status: AuctionStatus.WHITELIST_OPEN,
          time: auction.whitelistConfig.startTime,
          completed: now >= auction.whitelistConfig.startTime,
        },
        {
          status: AuctionStatus.WHITELIST_CLOSED,
          time: auction.whitelistConfig.endTime,
          completed: now >= auction.whitelistConfig.endTime,
        },
        {
          status: AuctionStatus.AUCTION_ACTIVE,
          time: auction.auctionConfig.startTime,
          completed: now >= auction.auctionConfig.startTime,
        },
        {
          status: AuctionStatus.ENDED,
          time: auction.auctionConfig.endTime,
          completed: now >= auction.auctionConfig.endTime,
        },
      ];

      // Find next transition
      const nextTransition = timeline.find((item) => !item.completed);

      return {
        currentStatus: auction.status,
        nextTransition: nextTransition
          ? {
              status: nextTransition.status,
              scheduledTime: nextTransition.time,
              timeUntil: nextTransition.time.getTime() - now.getTime(),
            }
          : undefined,
        timeline,
      };
    } catch (error) {
      this.logger.error(
        `Error getting lifecycle status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
