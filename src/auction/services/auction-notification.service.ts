import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuctionGateway } from '../gateways/auction.gateway';
import { Auction } from '../schemas/auction.schema';
import { Bid } from '../schemas/bid.schema';
import { AuctionWhitelist } from '../schemas/auction-whitelist.schema';
import { NotificationDispatcherService } from '../../notification/services/notification-dispatcher.service';
import { CreateNotificationDto } from '../../notification/dto/create-notification.dto';
import {
  NotificationType,
  NotificationPriority,
  NotificationContentType,
  NotificationChannel,
} from '../../notification/types/notification.types';

/**
 * Service for handling real-time auction notifications and system notifications
 */
@Injectable()
export class AuctionNotificationService {
  private readonly logger = new Logger(AuctionNotificationService.name);

  constructor(
    @InjectModel(AuctionWhitelist.name)
    private whitelistModel: Model<AuctionWhitelist>,
    @Inject(forwardRef(() => AuctionGateway))
    private readonly auctionGateway: AuctionGateway,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

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
   * Scenario 1: auction been outbid by someone (notify only the outbid user)
   */
  async notifyBidOutbid(
    outbidUserId: Types.ObjectId,
    auctionId: string,
    outbidBid: Bid,
    newBid: Bid,
    auction: Auction,
  ): Promise<void> {
    try {
      // WebSocket notification for real-time updates
      await this.auctionGateway.notifyBidOutbid(outbidUserId.toString(), {
        type: 'bid_outbid',
        auctionId,
        outbidBid,
        newBid,
        message: 'Your bid has been outbid',
      });

      // System notification for persistent delivery
      const notification: CreateNotificationDto = {
        type: NotificationType.AUCTION_BID,
        priority: NotificationPriority.HIGH,
        recipientId: outbidUserId.toString(),
        content: {
          type: NotificationContentType.ACTION,
          data: {
            title: 'Your Bid Has Been Outbid!',
            message: `Your bid of ${outbidBid.amount} HASH on "${auction.title}" has been outbid with a new bid of ${newBid.amount} HASH.`,
            metadata: {
              auctionId: auctionId,
              outbidAmount: outbidBid.amount,
              newBidAmount: newBid.amount,
              auctionTitle: auction.title,
            },
            actions: [
              {
                id: 'view_auction',
                label: 'View Auction',
                type: 'link',
                url: `/auctions/${auctionId}`,
                style: 'primary',
              },
              {
                id: 'place_new_bid',
                label: 'Place New Bid',
                type: 'button',
                action: 'navigate_to_bid',
                style: 'secondary',
              },
            ],
            iconUrl: '/icons/auction-outbid.png',
          },
        },
        channels: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
        relatedEntityId: auctionId,
        relatedEntityType: 'auction',
        metadata: {
          source: 'auction_system',
          event: 'bid_outbid',
          auctionTitle: auction.title,
        },
      };

      await this.notificationDispatcher.sendNotification(notification);

      this.logger.log(
        `Notified bid outbid: User ${outbidUserId} outbid by ${newBid.amount} HASH in auction ${auctionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error notifying bid outbid: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify auction starting
   * Scenario 2: auction start (notify only the whitelisted users)
   */
  async notifyAuctionStarted(
    auctionId: string,
    auction: Auction,
  ): Promise<void> {
    try {
      // WebSocket notification for real-time updates
      await this.auctionGateway.broadcastAuctionUpdate(auctionId, {
        type: 'auction_started',
        auction,
        message: 'Auction has started - bidding is now open',
      });

      // Get all whitelisted users for this auction
      const whitelistedUsers = await this.whitelistModel
        .find({ auctionId: new Types.ObjectId(auctionId) })
        .select('operatorId')
        .lean();

      if (whitelistedUsers.length > 0) {
        const userIds = whitelistedUsers.map((entry) => entry.operatorId);

        // Create notification for whitelisted users
        const notifications = userIds.map((userId) => ({
          notification: {
            type: NotificationType.AUCTION_WHITELIST,
            priority: NotificationPriority.HIGH,
            recipientId: userId.toString(),
            content: {
              type: NotificationContentType.ACTION,
              data: {
                title: 'Auction Started!',
                message: `The auction "${auction.title}" has started! You can now place your bids.`,
                metadata: {
                  auctionId: auctionId,
                  auctionTitle: auction.title,
                  startingPrice: auction.startingPrice,
                  endTime: auction.auctionConfig.endTime,
                },
                actions: [
                  {
                    id: 'place_bid',
                    label: 'Place Bid',
                    type: 'link',
                    url: `/auctions/${auctionId}`,
                    style: 'primary',
                  },
                  {
                    id: 'view_details',
                    label: 'View Details',
                    type: 'link',
                    url: `/auctions/${auctionId}/details`,
                    style: 'secondary',
                  },
                ],
                iconUrl: '/icons/auction-start.png',
              },
            },
            channels: [
              NotificationChannel.IN_APP,
              NotificationChannel.WEBSOCKET,
            ],
            relatedEntityId: auctionId,
            relatedEntityType: 'auction',
            metadata: {
              source: 'auction_system',
              event: 'auction_started',
              auctionTitle: auction.title,
            },
          } as CreateNotificationDto,
          userId,
        }));

        await this.notificationDispatcher.sendBatchNotifications(
          notifications,
          {
            batchId: `auction_started_${auctionId}_${Date.now()}`,
            priority: NotificationPriority.HIGH,
          },
        );

        this.logger.log(
          `Notified ${userIds.length} whitelisted users about auction start: ${auctionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error notifying auction started: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify auction winner
   * Scenario 3: auction won by someone (notify the winner)
   */
  async notifyAuctionWon(
    winnerId: Types.ObjectId,
    auctionId: string,
    auction: Auction,
    winningBid: Bid,
  ): Promise<void> {
    try {
      // System notification for the winner
      const notification: CreateNotificationDto = {
        type: NotificationType.AUCTION_BID,
        priority: NotificationPriority.CRITICAL,
        recipientId: winnerId.toString(),
        content: {
          type: NotificationContentType.ACTION,
          data: {
            title: '🎉 Congratulations! You Won the Auction!',
            message: `You have won the auction "${auction.title}" with your bid of ${winningBid.amount} HASH!`,
            metadata: {
              auctionId: auctionId,
              auctionTitle: auction.title,
              winningAmount: winningBid.amount,
              bidId: winningBid._id.toString(),
            },
            actions: [
              {
                id: 'view_nft',
                label: 'View Your NFT',
                type: 'link',
                url: `/nfts/${auction.nftId}`,
                style: 'primary',
              },
              {
                id: 'view_auction_details',
                label: 'View Auction Details',
                type: 'link',
                url: `/auctions/${auctionId}`,
                style: 'secondary',
              },
            ],
            iconUrl: '/icons/auction-winner.png',
          },
        },
        channels: [NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
        relatedEntityId: auctionId,
        relatedEntityType: 'auction',
        metadata: {
          source: 'auction_system',
          event: 'auction_won',
          auctionTitle: auction.title,
          winningAmount: winningBid.amount,
        },
      };

      await this.notificationDispatcher.sendNotification(notification);

      this.logger.log(
        `Notified auction winner: User ${winnerId} won auction ${auctionId} with ${winningBid.amount} HASH`,
      );
    } catch (error) {
      this.logger.error(
        `Error notifying auction winner: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify auction ended
   * Scenario 4: auction finished (notify only the whitelisted users)
   */
  async notifyAuctionEnded(auctionId: string, auction: Auction): Promise<void> {
    try {
      // WebSocket notification for real-time updates
      await this.auctionGateway.broadcastAuctionEnded(auctionId, {
        type: 'auction_ended',
        auction,
        winner: auction.currentWinner,
        finalPrice: auction.currentHighestBid,
      });

      // Get all whitelisted users for this auction
      const whitelistedUsers = await this.whitelistModel
        .find({ auctionId: new Types.ObjectId(auctionId) })
        .select('operatorId')
        .lean();

      if (whitelistedUsers.length > 0) {
        const userIds = whitelistedUsers.map((entry) => entry.operatorId);

        // Create notification for whitelisted users
        const notifications = userIds.map((userId) => {
          const isWinner = auction.currentWinner?.equals(userId);
          const title = isWinner
            ? '🎉 Auction Ended - You Won!'
            : 'Auction Ended';
          const message = isWinner
            ? `The auction "${auction.title}" has ended and you are the winner with ${auction.currentHighestBid} HASH!`
            : auction.currentWinner
              ? `The auction "${auction.title}" has ended. The winning bid was ${auction.currentHighestBid} HASH.`
              : `The auction "${auction.title}" has ended with no bids.`;

          return {
            notification: {
              type: NotificationType.AUCTION_WHITELIST,
              priority: isWinner
                ? NotificationPriority.CRITICAL
                : NotificationPriority.MEDIUM,
              recipientId: userId.toString(),
              content: {
                type: NotificationContentType.ACTION,
                data: {
                  title,
                  message,
                  metadata: {
                    auctionId: auctionId,
                    auctionTitle: auction.title,
                    finalPrice: auction.currentHighestBid,
                    hasWinner: !!auction.currentWinner,
                    isWinner,
                  },
                  actions: [
                    {
                      id: 'view_results',
                      label: 'View Results',
                      type: 'link',
                      url: `/auctions/${auctionId}/results`,
                      style: 'primary',
                    },
                    {
                      id: 'browse_auctions',
                      label: 'Browse Other Auctions',
                      type: 'link',
                      url: '/auctions',
                      style: 'secondary',
                    },
                  ],
                  iconUrl: isWinner
                    ? '/icons/auction-winner.png'
                    : '/icons/auction-ended.png',
                },
              },
              channels: [
                NotificationChannel.IN_APP,
                NotificationChannel.WEBSOCKET,
              ],
              relatedEntityId: auctionId,
              relatedEntityType: 'auction',
              metadata: {
                source: 'auction_system',
                event: 'auction_ended',
                auctionTitle: auction.title,
                isWinner,
              },
            } as CreateNotificationDto,
            userId,
          };
        });

        await this.notificationDispatcher.sendBatchNotifications(
          notifications,
          {
            batchId: `auction_ended_${auctionId}_${Date.now()}`,
            priority: NotificationPriority.MEDIUM,
          },
        );

        this.logger.log(
          `Notified ${userIds.length} whitelisted users about auction end: ${auctionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error notifying auction ended: ${error.message}`,
        error.stack,
      );
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
}
