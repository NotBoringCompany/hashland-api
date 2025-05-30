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
import { AuctionService } from '../auction.service';
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

      // Validate bidder matches connected user
      if (placeBidDto.bidderId !== operatorId) {
        client.emit('error', { message: 'Invalid bidder ID' });
        return;
      }

      // Extract auction ID from the bid data (assuming it's passed in metadata or we need to modify the DTO)
      // For now, we'll need to get it from the room the client is in
      const rooms = Array.from(client.rooms);
      const auctionRoom = rooms.find((room) => room.startsWith('auction_'));

      if (!auctionRoom) {
        client.emit('error', { message: 'Not in any auction room' });
        return;
      }

      const auctionId = auctionRoom.replace('auction_', '');

      // Place the bid
      const bid = await this.auctionService.placeBid(
        new Types.ObjectId(auctionId),
        new Types.ObjectId(placeBidDto.bidderId),
        placeBidDto.amount,
        placeBidDto.bidType,
        {
          ...placeBidDto.metadata,
          source: 'websocket',
          socketId: client.id,
          timestamp: new Date().toISOString(),
        } as any,
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
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Bid placed via WebSocket: ${bid._id} in auction ${auctionId}`,
      );
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
