import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuctionService } from '../services/auction.service';
import { WebSocketAuthService } from '../services/websocket-auth.service';
import {
  PlaceBidDto,
  JoinAuctionDto,
  LeaveAuctionDto,
  GetAuctionStatusDto,
} from '../dto';

/**
 * WebSocket gateway for real-time auction functionality
 * Handles bidding, auction updates, and notifications
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/auction',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuctionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuctionGateway.name);
  private readonly connectedUsers = new Map<string, string>(); // socketId -> operatorId

  constructor(
    private readonly auctionService: AuctionService,
    private readonly webSocketAuthService: WebSocketAuthService,
  ) {}

  /**
   * Gateway initialization
   */
  afterInit(): void {
    this.logger.log('Auction WebSocket Gateway initialized');
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Check connection rate limiting
      const clientIp = this.webSocketAuthService.getClientIp(client);
      const rateLimitCheck =
        this.webSocketAuthService.checkConnectionRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        this.logger.warn(`Connection rate limit exceeded for IP: ${clientIp}`);
        client.emit('error', {
          message: 'Too many connection attempts. Please try again later.',
          resetTime: rateLimitCheck.resetTime,
        });
        client.disconnect();
        return;
      }

      const operatorId = this.webSocketAuthService.extractOperatorId(client);
      if (!operatorId) {
        client.disconnect();
        return;
      }

      this.connectedUsers.set(client.id, operatorId);
      this.logger.log(
        `Client connected: ${client.id} (Operator: ${operatorId})`,
      );

      // Send connection confirmation
      client.emit('connection_confirmed', {
        message: 'Connected to auction system',
        operatorId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    const operatorId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    this.logger.log(
      `Client disconnected: ${client.id} (Operator: ${operatorId})`,
    );
  }

  /**
   * Join auction room for real-time updates
   */
  @SubscribeMessage('join_auction')
  async handleJoinAuction(
    @MessageBody() data: JoinAuctionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const { auctionId } = data;
      const operatorId = this.connectedUsers.get(client.id);

      if (!operatorId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Validate auction access with comprehensive checks
      const hasAccess = await this.webSocketAuthService.validateAuctionAccess(
        operatorId,
        auctionId,
      );

      if (!hasAccess) {
        client.emit('error', {
          message:
            'Access denied to auction. You may not be whitelisted or auction may not be accessible.',
        });
        return;
      }

      // Validate auction exists
      const auction = await this.auctionService.getAuctionById(
        new Types.ObjectId(auctionId),
        true,
      );

      if (!auction) {
        client.emit('error', { message: 'Auction not found' });
        return;
      }

      // Join auction room
      const roomName = `auction_${auctionId}`;
      await client.join(roomName);

      this.logger.log(
        `Operator ${operatorId} joined auction room: ${roomName}`,
      );

      // Send current auction status
      client.emit('auction_status', {
        auction,
        timestamp: new Date().toISOString(),
      });

      // Notify room about new participant
      client.to(roomName).emit('user_joined', {
        operatorId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error joining auction: ${error.message}`);
      client.emit('error', { message: 'Failed to join auction' });
    }
  }

  /**
   * Leave auction room
   */
  @SubscribeMessage('leave_auction')
  async handleLeaveAuction(
    @MessageBody() data: LeaveAuctionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const { auctionId } = data;
      const operatorId = this.connectedUsers.get(client.id);

      if (!operatorId) {
        return;
      }

      const roomName = `auction_${auctionId}`;
      await client.leave(roomName);

      this.logger.log(`Operator ${operatorId} left auction room: ${roomName}`);

      // Notify room about participant leaving
      client.to(roomName).emit('user_left', {
        operatorId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error leaving auction: ${error.message}`);
    }
  }

  /**
   * Place bid via WebSocket
   */
  @SubscribeMessage('place_bid')
  async handlePlaceBid(
    @MessageBody() placeBidDto: PlaceBidDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const operatorId = this.connectedUsers.get(client.id);

      if (!operatorId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Check bid rate limiting
      const rateLimitCheck =
        this.webSocketAuthService.checkBidRateLimit(operatorId);
      if (!rateLimitCheck.allowed) {
        client.emit('bid_error', {
          message: 'Too many bid attempts. Please slow down.',
          resetTime: rateLimitCheck.resetTime,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate bidder matches connected user
      if (placeBidDto.bidderId !== operatorId) {
        client.emit('error', { message: 'Invalid bidder ID' });
        return;
      }

      // Extract auction ID from the room the client is in
      const rooms = Array.from(client.rooms);
      const auctionRoom = rooms.find((room) => room.startsWith('auction_'));

      if (!auctionRoom) {
        client.emit('error', { message: 'Not in any auction room' });
        return;
      }

      const auctionId = auctionRoom.replace('auction_', '');

      // Validate operator permissions for bidding
      const hasPermission =
        await this.webSocketAuthService.validateOperatorPermissions(
          operatorId,
          'place_bid',
        );

      if (!hasPermission) {
        client.emit('bid_error', {
          message: 'You do not have permission to place bids',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Comprehensive bidding permission validation
      const canBid = await this.webSocketAuthService.validateBiddingPermission(
        operatorId,
        auctionId,
      );

      if (!canBid) {
        client.emit('bid_error', {
          message:
            'Bidding not allowed. Check auction status, whitelist, balance, and timing.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate bid amount
      const bidValidation = await this.webSocketAuthService.validateBidAmount(
        auctionId,
        placeBidDto.amount,
      );

      if (!bidValidation.valid) {
        client.emit('bid_error', {
          message: bidValidation.reason,
          minAmount: bidValidation.minAmount,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate sufficient balance
      const hasBalance =
        await this.webSocketAuthService.validateSufficientBalance(
          operatorId,
          placeBidDto.amount,
        );

      if (!hasBalance) {
        client.emit('bid_error', {
          message: 'Insufficient HASH balance for this bid',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Place the bid - use queue for high-frequency scenarios
      const shouldUseQueue = await this.auctionService.shouldUseQueue(
        new Types.ObjectId(auctionId),
      );

      const bidMetadata = {
        ...placeBidDto.metadata,
        source: 'websocket',
        socketId: client.id,
        timestamp: new Date().toISOString(),
        clientIp: this.webSocketAuthService.getClientIp(client),
      };

      if (shouldUseQueue) {
        // Use queue for high-frequency processing
        const queueResult = await this.auctionService.placeBidQueued(
          new Types.ObjectId(auctionId),
          new Types.ObjectId(placeBidDto.bidderId),
          placeBidDto.amount,
          placeBidDto.bidType,
          bidMetadata,
        );

        // Send queue confirmation to bidder
        client.emit('bid_placed', {
          jobId: queueResult.jobId,
          message: queueResult.message,
          queued: true,
          timestamp: new Date().toISOString(),
        });

        this.logger.log(
          `Bid queued via WebSocket: job ${queueResult.jobId} in auction ${auctionId}`,
        );
      } else {
        // Use direct processing for low-frequency scenarios
        const bid = await this.auctionService.placeBid(
          new Types.ObjectId(auctionId),
          new Types.ObjectId(placeBidDto.bidderId),
          placeBidDto.amount,
          placeBidDto.bidType,
          bidMetadata,
        );

        // Get updated auction data
        const updatedAuction = await this.auctionService.getAuctionById(
          new Types.ObjectId(auctionId),
          true,
        );

        // Broadcast bid to all users in auction room
        this.server.to(auctionRoom).emit('new_bid', {
          bid,
          auction: updatedAuction,
          timestamp: new Date().toISOString(),
        });

        // Send confirmation to bidder
        client.emit('bid_placed', {
          bid,
          message: 'Bid placed successfully',
          queued: false,
          timestamp: new Date().toISOString(),
        });

        this.logger.log(
          `Bid placed directly via WebSocket: ${bid._id} in auction ${auctionId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error placing bid: ${error.message}`);
      client.emit('bid_error', {
        message: error.message || 'Failed to place bid',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current auction status
   */
  @SubscribeMessage('get_auction_status')
  async handleGetAuctionStatus(
    @MessageBody() data: GetAuctionStatusDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const { auctionId } = data;
      const operatorId = this.connectedUsers.get(client.id);

      if (!operatorId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      const auction = await this.auctionService.getAuctionById(
        new Types.ObjectId(auctionId),
        true,
      );

      if (!auction) {
        client.emit('error', { message: 'Auction not found' });
        return;
      }

      client.emit('auction_status', {
        auction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error getting auction status: ${error.message}`);
      client.emit('error', { message: 'Failed to get auction status' });
    }
  }

  /**
   * Broadcast auction update to all connected clients in auction room
   */
  async broadcastAuctionUpdate(
    auctionId: string,
    updateData: any,
  ): Promise<void> {
    const roomName = `auction_${auctionId}`;
    this.server.to(roomName).emit('auction_updated', {
      ...updateData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast bid outbid notification to specific user
   */
  async notifyBidOutbid(operatorId: string, bidData: any): Promise<void> {
    // Find socket for the operator
    const socketId = Array.from(this.connectedUsers.entries()).find(
      ([, opId]) => opId === operatorId,
    )?.[0];

    if (socketId) {
      this.server.to(socketId).emit('bid_outbid', {
        ...bidData,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast auction ending soon warning
   */
  async broadcastAuctionEndingSoon(
    auctionId: string,
    minutesLeft: number,
  ): Promise<void> {
    const roomName = `auction_${auctionId}`;
    this.server.to(roomName).emit('auction_ending_soon', {
      auctionId,
      minutesLeft,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast auction ended notification
   */
  async broadcastAuctionEnded(
    auctionId: string,
    auctionData: any,
  ): Promise<void> {
    const roomName = `auction_${auctionId}`;
    this.server.to(roomName).emit('auction_ended', {
      ...auctionData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast whitelist status change
   */
  async broadcastWhitelistStatusChange(
    auctionId: string,
    status: string,
  ): Promise<void> {
    const roomName = `auction_${auctionId}`;
    this.server.to(roomName).emit('whitelist_status_changed', {
      auctionId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Extract operator ID from socket authentication
   */
  private extractOperatorId(client: Socket): string | null {
    return this.webSocketAuthService.extractOperatorId(client);
  }
}
