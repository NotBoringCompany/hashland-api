import { Injectable, Logger } from '@nestjs/common';
import { AuctionGateway } from '../gateways/auction.gateway';
import { Auction } from '../schemas/auction.schema';
import { Bid } from '../schemas/bid.schema';

/**
 * Service for handling real-time auction notifications
 */
@Injectable()
export class AuctionNotificationService {
  private readonly logger = new Logger(AuctionNotificationService.name);

  constructor(private readonly auctionGateway: AuctionGateway) {}

  /**
   * Notify about new bid placed
   */
  async notifyNewBid(
    auctionId: string,
    bid: Bid,
    auction: Auction,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'new_bid',
        bid,
        auction,
      });

      this.logger.log(`Notified new bid: ${bid._id} in auction ${auctionId}`);
    } catch (error) {
      this.logger.error(`Error notifying new bid: ${error.message}`);
    }
  }

  /**
   * Notify user that their bid was outbid
   */
  async notifyBidOutbid(
    operatorId: string,
    auctionId: string,
    outbidBid: Bid,
    newBid: Bid,
  ): Promise<void> {
    try {
      await this.auctionGateway.notifyBidOutbid(operatorId, {
        type: 'bid_outbid',
        auctionId,
        outbidBid,
        newBid,
        message: 'Your bid has been outbid',
      });

      this.logger.log(`Notified bid outbid: ${outbidBid._id} by ${newBid._id}`);
    } catch (error) {
      this.logger.error(`Error notifying bid outbid: ${error.message}`);
    }
  }

  /**
   * Notify auction ending soon
   */
  async notifyAuctionEndingSoon(
    auctionId: string,
    minutesLeft: number,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionEndingSoon(
        auctionId,
        minutesLeft,
      );

      this.logger.log(
        `Notified auction ending soon: ${auctionId} (${minutesLeft} minutes)`,
      );
    } catch (error) {
      this.logger.error(
        `Error notifying auction ending soon: ${error.message}`,
      );
    }
  }

  /**
   * Notify auction ended
   */
  async notifyAuctionEnded(auctionId: string, auction: Auction): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionEnded(auctionId, {
        type: 'auction_ended',
        auction,
        winner: auction.currentWinner,
        finalPrice: auction.currentHighestBid,
      });

      this.logger.log(`Notified auction ended: ${auctionId}`);
    } catch (error) {
      this.logger.error(`Error notifying auction ended: ${error.message}`);
    }
  }

  /**
   * Notify whitelist status change
   */
  async notifyWhitelistStatusChange(
    auctionId: string,
    status: string,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastWhitelistStatusChange(
        auctionId,
        status,
      );

      this.logger.log(
        `Notified whitelist status change: ${auctionId} -> ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Error notifying whitelist status change: ${error.message}`,
      );
    }
  }

  /**
   * Notify auction status change
   */
  async notifyAuctionStatusChange(
    auctionId: string,
    auction: Auction,
    previousStatus: string,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'status_change',
        auction,
        previousStatus,
        newStatus: auction.status,
      });

      this.logger.log(
        `Notified auction status change: ${auctionId} (${previousStatus} -> ${auction.status})`,
      );
    } catch (error) {
      this.logger.error(
        `Error notifying auction status change: ${error.message}`,
      );
    }
  }

  /**
   * Notify whitelist opened
   */
  async notifyWhitelistOpened(
    auctionId: string,
    auction: Auction,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'whitelist_opened',
        auction,
        message: 'Whitelist is now open for registration',
      });

      this.logger.log(`Notified whitelist opened: ${auctionId}`);
    } catch (error) {
      this.logger.error(`Error notifying whitelist opened: ${error.message}`);
    }
  }

  /**
   * Notify whitelist closed
   */
  async notifyWhitelistClosed(
    auctionId: string,
    auction: Auction,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'whitelist_closed',
        auction,
        message: 'Whitelist registration has ended',
      });

      this.logger.log(`Notified whitelist closed: ${auctionId}`);
    } catch (error) {
      this.logger.error(`Error notifying whitelist closed: ${error.message}`);
    }
  }

  /**
   * Notify auction started
   */
  async notifyAuctionStarted(
    auctionId: string,
    auction: Auction,
  ): Promise<void> {
    try {
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'auction_started',
        auction,
        message: 'Auction has started - bidding is now open',
      });

      this.logger.log(`Notified auction started: ${auctionId}`);
    } catch (error) {
      this.logger.error(`Error notifying auction started: ${error.message}`);
    }
  }
}
