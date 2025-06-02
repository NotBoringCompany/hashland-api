import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io';
import { Auction, AuctionStatus } from '../schemas/auction.schema';
import { AuctionWhitelist } from '../schemas/auction-whitelist.schema';
import { Operator } from '../../operators/schemas/operator.schema';

/**
 * Service for handling WebSocket authentication
 */
@Injectable()
export class WebSocketAuthService {
  private readonly logger = new Logger(WebSocketAuthService.name);
  private readonly bidAttempts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly connectionAttempts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  // Rate limiting configuration
  private readonly MAX_BID_ATTEMPTS_PER_MINUTE = 10;
  private readonly MAX_CONNECTION_ATTEMPTS_PER_MINUTE = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(AuctionWhitelist.name)
    private whitelistModel: Model<AuctionWhitelist>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {
    // Clean up rate limiting maps every 5 minutes
    setInterval(
      () => {
        this.cleanupRateLimitMaps();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Extract and validate operator ID from socket authentication
   */
  extractOperatorId(client: Socket): string | null {
    try {
      // Extract token from various possible locations
      let token = client.handshake.auth?.token;

      if (!token) {
        const authHeader = client.handshake.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        // Try query parameter as fallback
        token = client.handshake.query?.token as string;
      }

      if (!token) {
        this.logger.warn('No authentication token provided');
        return null;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);

      if (!payload || !payload.sub) {
        this.logger.warn('Invalid token payload');
        return null;
      }

      return payload.sub; // Assuming 'sub' contains the operator ID
    } catch (error) {
      this.logger.error(`Error extracting operator ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate if operator has permission to access auction
   */
  async validateAuctionAccess(
    operatorId: string,
    auctionId: string,
  ): Promise<boolean> {
    try {
      // Validate operator exists
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        this.logger.warn(`Operator not found: ${operatorId}`);
        return false;
      }

      // Validate auction exists
      const auction = await this.auctionModel.findById(auctionId);
      if (!auction) {
        this.logger.warn(`Auction not found: ${auctionId}`);
        return false;
      }

      // Check if auction is in a viewable state
      if (auction.status === 'draft' || auction.status === 'cancelled') {
        this.logger.warn(
          `Auction not accessible: ${auctionId} (status: ${auction.status})`,
        );
        return false;
      }

      // For whitelist-only auctions, check if user is whitelisted
      if (
        auction.status === 'whitelist_open' ||
        auction.status === 'auction_active'
      ) {
        const whitelistEntry = await this.whitelistModel.findOne({
          auctionId: new Types.ObjectId(auctionId),
          operatorId: new Types.ObjectId(operatorId),
          status: 'confirmed',
        });

        if (!whitelistEntry) {
          this.logger.warn(
            `Operator not whitelisted for auction: ${operatorId} -> ${auctionId}`,
          );
          return false;
        }
      }

      this.logger.log(
        `Auction access validated: ${operatorId} -> ${auctionId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error validating auction access: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate if operator can place bids
   */
  async validateBiddingPermission(
    operatorId: string,
    auctionId: string,
  ): Promise<boolean> {
    try {
      // First check basic auction access
      const hasAccess = await this.validateAuctionAccess(operatorId, auctionId);
      if (!hasAccess) {
        return false;
      }

      // Get auction details
      const auction = await this.auctionModel.findById(auctionId);
      if (!auction) {
        this.logger.warn(
          `Auction not found for bidding validation: ${auctionId}`,
        );
        return false;
      }

      // Check if auction is in active bidding state
      if (auction.status !== AuctionStatus.AUCTION_ACTIVE) {
        this.logger.warn(
          `Auction not in active state for bidding: ${auctionId} (status: ${auction.status})`,
        );
        return false;
      }

      // Check if auction time is valid
      const now = new Date();
      if (now < auction.auctionConfig.startTime) {
        this.logger.warn(`Auction not started yet: ${auctionId}`);
        return false;
      }

      if (now > auction.auctionConfig.endTime) {
        this.logger.warn(`Auction already ended: ${auctionId}`);
        return false;
      }

      // Get operator details for balance validation
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        this.logger.warn(
          `Operator not found for bidding validation: ${operatorId}`,
        );
        return false;
      }

      // Check if operator has sufficient balance for minimum bid
      const minBidAmount = Math.max(
        auction.currentHighestBid + auction.auctionConfig.minBidIncrement,
        auction.startingPrice,
      );

      if (operator.currentHASH < minBidAmount) {
        this.logger.warn(
          `Insufficient balance for bidding: ${operatorId} (has: ${operator.currentHASH}, needs: ${minBidAmount})`,
        );
        return false;
      }

      // Check if operator is not the current highest bidder (prevent self-outbidding)
      if (
        auction.currentWinner &&
        auction.currentWinner.toString() === operatorId
      ) {
        this.logger.warn(
          `Operator is already the highest bidder: ${operatorId} -> ${auctionId}`,
        );
        return false;
      }

      // Additional business rules can be added here:
      // - Check for bid frequency limits
      // - Check for operator-specific restrictions
      // - Check for auction-specific rules

      this.logger.log(
        `Bidding permission validated: ${operatorId} -> ${auctionId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error validating bidding permission: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Validate bid amount against auction rules
   */
  async validateBidAmount(
    auctionId: string,
    bidAmount: number,
  ): Promise<{ valid: boolean; reason?: string; minAmount?: number }> {
    try {
      const auction = await this.auctionModel.findById(auctionId);
      if (!auction) {
        return { valid: false, reason: 'Auction not found' };
      }

      // Check minimum bid amount
      const minBidAmount = Math.max(
        auction.currentHighestBid + auction.auctionConfig.minBidIncrement,
        auction.startingPrice,
      );

      if (bidAmount < minBidAmount) {
        return {
          valid: false,
          reason: `Bid amount too low. Minimum required: ${minBidAmount} HASH`,
          minAmount: minBidAmount,
        };
      }

      // Check against reserve price if set
      if (
        auction.auctionConfig.reservePrice &&
        bidAmount < auction.auctionConfig.reservePrice
      ) {
        return {
          valid: false,
          reason: `Bid amount below reserve price: ${auction.auctionConfig.reservePrice} HASH`,
          minAmount: auction.auctionConfig.reservePrice,
        };
      }

      // Check buy now price if set
      if (
        auction.auctionConfig.buyNowPrice &&
        bidAmount >= auction.auctionConfig.buyNowPrice
      ) {
        // This is a buy-now bid, which is valid but should be handled specially
        return { valid: true };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error(`Error validating bid amount: ${error.message}`);
      return { valid: false, reason: 'Validation error occurred' };
    }
  }

  /**
   * Check if operator has sufficient balance for bid
   */
  async validateSufficientBalance(
    operatorId: string,
    bidAmount: number,
  ): Promise<boolean> {
    try {
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        this.logger.warn(
          `Operator not found for balance validation: ${operatorId}`,
        );
        return false;
      }

      const hasBalance = operator.currentHASH >= bidAmount;
      if (!hasBalance) {
        this.logger.warn(
          `Insufficient balance: ${operatorId} (has: ${operator.currentHASH}, needs: ${bidAmount})`,
        );
      }

      return hasBalance;
    } catch (error) {
      this.logger.error(`Error validating balance: ${error.message}`);
      return false;
    }
  }

  /**
   * Check rate limiting for bid attempts
   */
  checkBidRateLimit(operatorId: string): {
    allowed: boolean;
    resetTime?: number;
  } {
    const now = Date.now();
    const key = `bid_${operatorId}`;
    const attempts = this.bidAttempts.get(key);

    if (!attempts || now > attempts.resetTime) {
      // Reset or initialize
      this.bidAttempts.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    if (attempts.count >= this.MAX_BID_ATTEMPTS_PER_MINUTE) {
      this.logger.warn(`Bid rate limit exceeded for operator: ${operatorId}`);
      return { allowed: false, resetTime: attempts.resetTime };
    }

    // Increment count
    attempts.count++;
    return { allowed: true };
  }

  /**
   * Check rate limiting for connection attempts
   */
  checkConnectionRateLimit(clientIp: string): {
    allowed: boolean;
    resetTime?: number;
  } {
    const now = Date.now();
    const key = `conn_${clientIp}`;
    const attempts = this.connectionAttempts.get(key);

    if (!attempts || now > attempts.resetTime) {
      // Reset or initialize
      this.connectionAttempts.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    if (attempts.count >= this.MAX_CONNECTION_ATTEMPTS_PER_MINUTE) {
      this.logger.warn(`Connection rate limit exceeded for IP: ${clientIp}`);
      return { allowed: false, resetTime: attempts.resetTime };
    }

    // Increment count
    attempts.count++;
    return { allowed: true };
  }

  /**
   * Clean up expired rate limiting entries
   */
  private cleanupRateLimitMaps(): void {
    const now = Date.now();

    // Clean bid attempts
    for (const [key, attempts] of this.bidAttempts.entries()) {
      if (now > attempts.resetTime) {
        this.bidAttempts.delete(key);
      }
    }

    // Clean connection attempts
    for (const [key, attempts] of this.connectionAttempts.entries()) {
      if (now > attempts.resetTime) {
        this.connectionAttempts.delete(key);
      }
    }
  }

  /**
   * Validate operator permissions for specific actions
   */
  async validateOperatorPermissions(
    operatorId: string,
    action: 'view_auction' | 'place_bid' | 'join_whitelist',
  ): Promise<boolean> {
    try {
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        return false;
      }

      // Add any operator-specific permission checks here
      // For example: banned users, restricted accounts, etc.

      // Check if operator has any restrictions based on action
      switch (action) {
        case 'view_auction':
          // Basic validation - operator exists
          return true;

        case 'place_bid':
          // Additional checks for bidding
          // Could check for minimum account age, verification status, etc.
          return true;

        case 'join_whitelist':
          // Additional checks for whitelist joining
          return true;

        default:
          return false;
      }
    } catch (error) {
      this.logger.error(
        `Error validating operator permissions: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get client IP address from socket
   */
  getClientIp(client: Socket): string {
    return (
      (client.handshake.headers['x-forwarded-for'] as string) ||
      (client.handshake.headers['x-real-ip'] as string) ||
      client.conn.remoteAddress ||
      'unknown'
    );
  }
}
