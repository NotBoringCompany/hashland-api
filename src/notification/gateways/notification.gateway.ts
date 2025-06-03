import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationService } from '../services/notification.service';
import { NotificationGatewayService } from '../services/notification-gateway.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { NotificationAnalyticsService } from '../services/notification-analytics.service';
import {
  MarkNotificationReadRequest,
  MarkNotificationsReadRequest,
  DeleteNotificationRequest,
  TrackNotificationActionRequest,
  UpdatePreferencesRequest,
  NotificationErrorResponse,
  NotificationReadResponse,
  NotificationDeletedResponse,
  UserPreferencesUpdatedResponse,
} from '../types/notification-websocket.types';
import {
  NotificationChannel,
  NotificationPriority,
} from '../types/notification.types';

/**
 * WebSocket Gateway for handling real-time notification delivery and interactions
 *
 * This gateway:
 * - Manages real-time notification delivery via WebSockets
 * - Handles user authentication and room management
 * - Processes notification interactions (read, delete, action clicks)
 * - Manages user notification preferences
 * - Tracks delivery status and analytics
 * - Provides real-time unread count updates
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly gatewayService: NotificationGatewayService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly analyticsService: NotificationAnalyticsService,
  ) {}

  /**
   * Initialize the gateway
   */
  async onModuleInit(): Promise<void> {
    await this.gatewayService.onModuleInit();
    this.logger.log('NotificationGateway initialized');
  }

  /**
   * Handle client connection with authentication
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Authenticate client
      const userId = await this.gatewayService.authenticateClient(client);

      if (!userId) {
        this.logger.warn(`Unauthenticated connection attempt: ${client.id}`);
        client.emit('error', {
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid or missing authentication token',
          code: 'AUTH_001',
        } as NotificationErrorResponse);
        client.disconnect();
        return;
      }

      // Handle successful connection
      await this.gatewayService.handleConnection(client, userId);

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('error', {
        error: 'CONNECTION_ERROR',
        message: 'Failed to establish connection',
        code: 'CONN_001',
        details: error.message,
      } as NotificationErrorResponse);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.gatewayService.handleDisconnection(client);
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnection error: ${error.message}`, error.stack);
    }
  }

  /**
   * Mark a single notification as read
   */
  @SubscribeMessage('mark-notification-read')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MarkNotificationReadRequest,
  ): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      const notificationId = new Types.ObjectId(data.notificationId);

      const result = await this.notificationService.markAsRead(userId, {
        notificationIds: [notificationId],
      });

      if (result.modifiedCount > 0) {
        const response: NotificationReadResponse = {
          notificationId: data.notificationId,
          readAt: new Date().toISOString(),
        };

        client.emit('notification-read', response);

        // Track read analytics
        await this.analyticsService.trackRead(notificationId, userId);

        // Update unread count
        await this.gatewayService.updateUnreadCountForUser(this.server, userId);

        this.logger.debug(
          `Notification ${data.notificationId} marked as read by user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marking notification as read: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'MARK_READ_ERROR',
        message: 'Failed to mark notification as read',
        code: 'READ_001',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Mark multiple notifications as read
   */
  @SubscribeMessage('mark-notifications-read')
  async handleMarkNotificationsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MarkNotificationsReadRequest,
  ): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      const markReadDto: any = {
        markAll: data.markAll,
        types: data.types,
      };

      if (data.notificationIds?.length) {
        markReadDto.notificationIds = data.notificationIds.map(
          (id) => new Types.ObjectId(id),
        );
      }

      if (data.createdBefore) {
        markReadDto.createdBefore = new Date(data.createdBefore);
      }

      const result = await this.notificationService.markAsRead(
        userId,
        markReadDto,
      );

      if (result.modifiedCount > 0) {
        // Emit read events for each notification
        for (const notification of result.notifications) {
          const response: NotificationReadResponse = {
            notificationId: notification._id.toString(),
            readAt:
              notification.readAt?.toISOString() || new Date().toISOString(),
          };
          client.emit('notification-read', response);
        }

        // Update unread count
        await this.gatewayService.updateUnreadCountForUser(this.server, userId);

        this.logger.debug(
          `${result.modifiedCount} notifications marked as read by user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marking notifications as read: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'MARK_READ_BULK_ERROR',
        message: 'Failed to mark notifications as read',
        code: 'READ_002',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Delete a notification
   */
  @SubscribeMessage('delete-notification')
  async handleDeleteNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeleteNotificationRequest,
  ): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      const notificationId = new Types.ObjectId(data.notificationId);
      await this.notificationService.delete(notificationId, userId);

      const response: NotificationDeletedResponse = {
        notificationId: data.notificationId,
      };

      client.emit('notification-deleted', response);

      // Update unread count
      await this.gatewayService.updateUnreadCountForUser(this.server, userId);

      this.logger.debug(
        `Notification ${data.notificationId} deleted by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting notification: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'DELETE_ERROR',
        message: 'Failed to delete notification',
        code: 'DEL_001',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Get unread notification count
   */
  @SubscribeMessage('get-unread-count')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      await this.gatewayService.sendUnreadCount(client, userId);
    } catch (error) {
      this.logger.error(
        `Error getting unread count: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'UNREAD_COUNT_ERROR',
        message: 'Failed to get unread count',
        code: 'COUNT_001',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Track notification action (click, conversion)
   */
  @SubscribeMessage('track-notification-action')
  async handleTrackNotificationAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TrackNotificationActionRequest,
  ): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      const notificationId = new Types.ObjectId(data.notificationId);

      // Track analytics properly using the analytics service
      if (data.actionType === 'click') {
        await this.analyticsService.trackClick(notificationId, userId);
      } else if (data.actionType === 'conversion') {
        await this.analyticsService.trackConversion(notificationId, userId);
      }

      this.logger.debug(
        `Tracked ${data.actionType} for notification ${data.notificationId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking notification action: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'TRACK_ACTION_ERROR',
        message: 'Failed to track notification action',
        code: 'TRACK_001',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Update user notification preferences
   */
  @SubscribeMessage('update-preferences')
  async handleUpdatePreferences(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UpdatePreferencesRequest,
  ): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      // Get current preferences or create default
      let preferences = await this.preferenceService.findByUserId(userId);
      if (!preferences) {
        preferences = await this.preferenceService.create({
          userId,
          globalSettings: {
            enabled: true,
            maxPerDay: 50,
            batchDelivery: false,
            markAsReadOnView: true,
          },
          typePreferences: [],
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            overrideForCritical: true,
          },
        });
      }

      // Update preferences based on request
      if (typeof data.enabled !== 'undefined') {
        preferences.globalSettings.enabled = data.enabled;
      }

      if (data.types?.length) {
        for (const typeUpdate of data.types) {
          const existingIndex = preferences.typePreferences.findIndex(
            (pref) => pref.type === typeUpdate.type,
          );

          if (existingIndex >= 0) {
            preferences.typePreferences[existingIndex].enabled =
              typeUpdate.enabled;
            if (typeUpdate.channels) {
              preferences.typePreferences[existingIndex].channels =
                typeUpdate.channels;
            }
          } else {
            preferences.typePreferences.push({
              type: typeUpdate.type,
              enabled: typeUpdate.enabled,
              channels: typeUpdate.channels || [NotificationChannel.IN_APP],
              minPriority: NotificationPriority.LOW,
            });
          }
        }
      }

      if (data.quietHours) {
        preferences.quietHours = {
          ...preferences.quietHours,
          ...data.quietHours,
          timezone: data.quietHours.timezone || preferences.quietHours.timezone,
        };
      }

      await preferences.save();

      const response: UserPreferencesUpdatedResponse = {
        userId: userId.toString(),
        preferences: {
          globalSettings: preferences.globalSettings,
          typePreferences: preferences.typePreferences,
          quietHours: preferences.quietHours,
        },
      };

      client.emit('preferences-updated', response);

      this.logger.debug(`Preferences updated for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error updating preferences: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'PREFERENCES_UPDATE_ERROR',
        message: 'Failed to update preferences',
        code: 'PREF_001',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Get user notification preferences
   */
  @SubscribeMessage('get-preferences')
  async handleGetPreferences(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const userId = await this.getUserIdFromClient(client);
      if (!userId) return;

      const preferences = await this.preferenceService.findByUserId(userId);

      if (preferences) {
        const response: UserPreferencesUpdatedResponse = {
          userId: userId.toString(),
          preferences: {
            globalSettings: preferences.globalSettings,
            typePreferences: preferences.typePreferences,
            quietHours: preferences.quietHours,
          },
        };

        client.emit('preferences', response);
      } else {
        client.emit('error', {
          error: 'PREFERENCES_NOT_FOUND',
          message: 'User preferences not found',
          code: 'PREF_002',
        } as NotificationErrorResponse);
      }
    } catch (error) {
      this.logger.error(
        `Error getting preferences: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        error: 'PREFERENCES_GET_ERROR',
        message: 'Failed to get preferences',
        code: 'PREF_003',
        details: error.message,
      } as NotificationErrorResponse);
    }
  }

  /**
   * Send notification to specific users (used by services)
   */
  async sendNotificationToUsers(
    notification: any,
    targetUserIds: Types.ObjectId[],
  ): Promise<void> {
    await this.gatewayService.sendNotificationToUser(
      this.server,
      notification,
      targetUserIds,
    );
  }

  /**
   * Broadcast notification to all connected users (used by services)
   */
  async broadcastNotification(notification: any): Promise<void> {
    await this.gatewayService.broadcastNotification(this.server, notification);
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: Types.ObjectId): boolean {
    return this.gatewayService.isUserConnected(userId);
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics() {
    return this.gatewayService.getConnectionMetrics();
  }

  /**
   * Get user ID from authenticated client
   */
  private async getUserIdFromClient(
    client: Socket,
  ): Promise<Types.ObjectId | null> {
    try {
      return await this.gatewayService.authenticateClient(client);
    } catch (error) {
      this.logger.warn(
        `Failed to authenticate client ${client.id}: ${error.message}`,
      );
      client.emit('error', {
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for this operation',
        code: 'AUTH_002',
      } as NotificationErrorResponse);
      return null;
    }
  }
}
