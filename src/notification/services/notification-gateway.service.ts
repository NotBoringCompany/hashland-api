import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/common/redis.service';
import { NotificationService } from './notification.service';
import {
  NotificationClientData,
  UserRoomMapping,
  NotificationDeliveryTracking,
  ConnectionMetrics,
  NotificationReceivedResponse,
  UnreadCountUpdatedResponse,
} from '../types/notification-websocket.types';
import {
  NotificationChannel,
  NotificationStatus,
} from '../types/notification.types';
import { Notification } from '../schemas/notification.schema';

/**
 * Service for managing notification WebSocket operations
 */
@Injectable()
export class NotificationGatewayService {
  private readonly logger = new Logger(NotificationGatewayService.name);

  // Redis keys for storing notification gateway data
  private readonly redisConnectedUsersKey =
    'hashland-notifications:connected-users';
  private readonly redisUserRoomsKey = 'hashland-notifications:user-rooms';
  private readonly redisDeliveryTrackingKey =
    'hashland-notifications:delivery-tracking';
  private readonly redisConnectionMetricsKey =
    'hashland-notifications:connection-metrics';

  /**
   * Maps socket IDs to client data
   */
  private connectedClients = new Map<string, NotificationClientData>();

  /**
   * Maps user IDs to their socket IDs (allows multiple connections per user)
   */
  private userRooms = new Map<string, UserRoomMapping>();

  /**
   * Tracks notification delivery status
   */
  private deliveryTracking = new Map<string, NotificationDeliveryTracking>();

  /**
   * Connection metrics for monitoring
   */
  private connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    uniqueUsers: 0,
    connectionsPerUser: {},
    averageConnectionTime: 0,
    activeRooms: 0,
    lastUpdated: new Date(),
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Initialize gateway service by loading data from Redis
   */
  async onModuleInit(): Promise<void> {
    await this.loadDataFromRedis();
  }

  /**
   * Authenticate WebSocket client using JWT token
   */
  async authenticateClient(socket: Socket): Promise<Types.ObjectId | null> {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        this.logger.warn(`No token provided for socket ${socket.id}`);
        return null;
      }

      const payload = this.jwtService.verify(token);
      return new Types.ObjectId(payload.operatorId);
    } catch (error) {
      this.logger.warn(
        `Invalid token for socket ${socket.id}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Handle client connection
   */
  async handleConnection(
    socket: Socket,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      const userIdStr = userId.toString();
      const socketId = socket.id;

      // Store client data
      const clientData: NotificationClientData = {
        userId,
        socketId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
      };

      this.connectedClients.set(socketId, clientData);

      // Add to user room
      if (!this.userRooms.has(userIdStr)) {
        this.userRooms.set(userIdStr, {
          userId: userIdStr,
          socketIds: new Set(),
          lastActivity: new Date(),
        });
      }

      const userRoom = this.userRooms.get(userIdStr)!;
      userRoom.socketIds.add(socketId);
      userRoom.lastActivity = new Date();

      // Join user-specific room
      socket.join(`user:${userIdStr}`);

      // Update metrics
      this.updateConnectionMetrics();

      // Persist to Redis
      await this.saveDataToRedis();

      // Send connection status
      socket.emit('connection-status', {
        connected: true,
        userId: userIdStr,
        timestamp: new Date().toISOString(),
      });

      // Send current unread count
      await this.sendUnreadCount(socket, userId);

      this.logger.log(`User ${userIdStr} connected via socket ${socketId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle connection: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnection(socket: Socket): Promise<void> {
    try {
      const socketId = socket.id;
      const clientData = this.connectedClients.get(socketId);

      if (clientData) {
        const userIdStr = clientData.userId.toString();

        // Remove from connected clients
        this.connectedClients.delete(socketId);

        // Remove from user room
        const userRoom = this.userRooms.get(userIdStr);
        if (userRoom) {
          userRoom.socketIds.delete(socketId);
          if (userRoom.socketIds.size === 0) {
            this.userRooms.delete(userIdStr);
          }
        }

        // Update metrics
        this.updateConnectionMetrics();

        // Persist to Redis
        await this.saveDataToRedis();

        this.logger.log(
          `User ${userIdStr} disconnected from socket ${socketId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle disconnection: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send notification to specific user(s)
   */
  async sendNotificationToUser(
    server: Server,
    notification: Notification,
    targetUserIds: Types.ObjectId[],
  ): Promise<void> {
    try {
      const notificationResponse: NotificationReceivedResponse = {
        id: notification._id.toString(),
        type: notification.type,
        priority: notification.priority,
        content: notification.content,
        senderId: notification.senderId?.toString(),
        relatedEntityId: notification.relatedEntityId?.toString(),
        relatedEntityType: notification.relatedEntityType,
        createdAt: notification.createdAt.toISOString(),
        isRead: notification.isRead,
        expiresAt: notification.expiresAt?.toISOString(),
      };

      for (const userId of targetUserIds) {
        const userIdStr = userId.toString();
        const userRoom = this.userRooms.get(userIdStr);

        if (userRoom && userRoom.socketIds.size > 0) {
          // Send to user's room
          server
            .to(`user:${userIdStr}`)
            .emit('notification', notificationResponse);

          // Track delivery
          await this.trackDelivery(
            notification._id,
            userId,
            NotificationChannel.WEBSOCKET,
            NotificationStatus.DELIVERED,
          );

          this.logger.debug(
            `Notification sent to user ${userIdStr} via WebSocket`,
          );
        } else {
          // User not connected, track as failed
          await this.trackDelivery(
            notification._id,
            userId,
            NotificationChannel.WEBSOCKET,
            NotificationStatus.FAILED,
            'User not connected',
          );

          this.logger.debug(
            `User ${userIdStr} not connected, notification delivery failed`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Broadcast notification to all connected users
   */
  async broadcastNotification(
    server: Server,
    notification: Notification,
  ): Promise<void> {
    try {
      const notificationResponse: NotificationReceivedResponse = {
        id: notification._id.toString(),
        type: notification.type,
        priority: notification.priority,
        content: notification.content,
        senderId: notification.senderId?.toString(),
        relatedEntityId: notification.relatedEntityId?.toString(),
        relatedEntityType: notification.relatedEntityType,
        createdAt: notification.createdAt.toISOString(),
        isRead: notification.isRead,
        expiresAt: notification.expiresAt?.toISOString(),
      };

      // Broadcast to all connected users
      server.emit('notification', notificationResponse);

      // Track delivery for all connected users
      for (const [userIdStr] of this.userRooms) {
        await this.trackDelivery(
          notification._id,
          new Types.ObjectId(userIdStr),
          NotificationChannel.WEBSOCKET,
          NotificationStatus.DELIVERED,
        );
      }

      this.logger.log(
        `Broadcast notification sent to ${this.userRooms.size} connected users`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send unread count to specific socket
   */
  async sendUnreadCount(socket: Socket, userId: Types.ObjectId): Promise<void> {
    try {
      const unreadCount = await this.notificationService.getUnreadCount(
        userId,
        {
          groupByType: true,
          groupByPriority: true,
        },
      );

      const response: UnreadCountUpdatedResponse = {
        total: unreadCount.total,
        byType: unreadCount.byType,
        byPriority: unreadCount.byPriority,
      };

      socket.emit('unread-count-updated', response);
    } catch (error) {
      this.logger.error(
        `Failed to send unread count: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Update unread count for specific user
   */
  async updateUnreadCountForUser(
    server: Server,
    userId: Types.ObjectId,
  ): Promise<void> {
    try {
      const userIdStr = userId.toString();
      const userRoom = this.userRooms.get(userIdStr);

      if (userRoom && userRoom.socketIds.size > 0) {
        const unreadCount = await this.notificationService.getUnreadCount(
          userId,
          {
            groupByType: true,
            groupByPriority: true,
          },
        );

        const response: UnreadCountUpdatedResponse = {
          total: unreadCount.total,
          byType: unreadCount.byType,
          byPriority: unreadCount.byPriority,
        };

        server.to(`user:${userIdStr}`).emit('unread-count-updated', response);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update unread count: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: Types.ObjectId): boolean {
    return this.userRooms.has(userId.toString());
  }

  /**
   * Get all socket IDs for a user
   */
  getUserSocketIds(userId: Types.ObjectId): string[] {
    const userRoom = this.userRooms.get(userId.toString());
    return userRoom ? Array.from(userRoom.socketIds) : [];
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  /**
   * Track notification delivery
   */
  private async trackDelivery(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
    channel: NotificationChannel,
    status: NotificationStatus,
    failureReason?: string,
  ): Promise<void> {
    try {
      const trackingKey = `${notificationId}_${userId}_${channel}`;
      const tracking: NotificationDeliveryTracking = {
        notificationId,
        userId,
        channel,
        status,
        attempts: 1,
        lastAttempt: new Date(),
        deliveredAt:
          status === NotificationStatus.DELIVERED ? new Date() : undefined,
        failureReason,
      };

      this.deliveryTracking.set(trackingKey, tracking);

      // Update database delivery status
      await this.notificationService.updateDeliveryStatus(
        notificationId,
        channel,
        status,
        failureReason,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track delivery: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(): void {
    this.connectionMetrics = {
      totalConnections: this.connectedClients.size,
      uniqueUsers: this.userRooms.size,
      connectionsPerUser: Array.from(this.userRooms.entries()).reduce(
        (acc, [userId, room]) => {
          acc[userId] = room.socketIds.size;
          return acc;
        },
        {} as Record<string, number>,
      ),
      averageConnectionTime: this.calculateAverageConnectionTime(),
      activeRooms: this.userRooms.size,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate average connection time
   */
  private calculateAverageConnectionTime(): number {
    if (this.connectedClients.size === 0) return 0;

    const now = new Date();
    const totalTime = Array.from(this.connectedClients.values()).reduce(
      (sum, client) => sum + (now.getTime() - client.connectedAt.getTime()),
      0,
    );

    return totalTime / this.connectedClients.size;
  }

  /**
   * Load data from Redis
   */
  private async loadDataFromRedis(): Promise<void> {
    try {
      // Load connection metrics
      const metricsData = await this.redisService.get(
        this.redisConnectionMetricsKey,
      );
      if (metricsData) {
        this.connectionMetrics = JSON.parse(metricsData);
      }

      this.logger.log('Notification gateway data loaded from Redis');
    } catch (error) {
      this.logger.error(
        `Failed to load data from Redis: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Save data to Redis
   */
  private async saveDataToRedis(): Promise<void> {
    try {
      // Save connection metrics
      await this.redisService.set(
        this.redisConnectionMetricsKey,
        JSON.stringify(this.connectionMetrics),
      );

      // Note: We don't persist runtime data like connected clients and user rooms
      // as they should be rebuilt on server restart
    } catch (error) {
      this.logger.error(
        `Failed to save data to Redis: ${error.message}`,
        error.stack,
      );
    }
  }
}
