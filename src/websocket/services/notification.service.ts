import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionManagerService } from './connection-manager.service';
import {
  NotificationPayload,
  NotificationType,
  UserNotification,
} from '../notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private server: Server;

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  /**
   * Set the WebSocket server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Send a notification to a specific user
   */
  sendToUser(userId: string, notification: NotificationPayload): boolean {
    try {
      if (!this.server) {
        this.logger.error('WebSocket server not initialized');
        return false;
      }

      const connections = this.connectionManager.getUserConnections(userId);

      if (!connections || connections.length === 0) {
        this.logger.warn(`No active connections for user ${userId}`);
        return false;
      }

      const userNotification: UserNotification = {
        id: uuidv4(),
        userId: connections[0].userId, // Use the ObjectId from the connection
        read: false,
        ...notification,
        timestamp: notification.timestamp || new Date(),
      };

      // Send to all connections for this user
      let sent = false;
      for (const connection of connections) {
        const connectedSockets = this.server.sockets.sockets;
        if (connectedSockets) {
          const socket = connectedSockets.get(connection.socketId);
          if (socket) {
            socket.emit('notification', userNotification);
            sent = true;
            this.logger.debug(
              `Notification sent to user ${userId} via socket ${connection.socketId}`,
            );
          }
        }
      }

      return sent;
    } catch (error) {
      this.logger.error(
        `Error sending notification to user ${userId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Broadcast a notification to all connected users
   */
  broadcastToAll(notification: NotificationPayload): void {
    try {
      if (!this.server) {
        this.logger.error('WebSocket server not initialized');
        return;
      }

      const broadcastNotification = {
        id: uuidv4(),
        ...notification,
        timestamp: notification.timestamp || new Date(),
      };

      this.server.emit('notification', broadcastNotification);
      this.logger.log(
        `Broadcast notification sent to all users: ${notification.title}`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send a system notification to a specific user
   */
  sendSystemNotification(
    userId: string,
    title: string,
    message: string,
    data?: any,
  ): boolean {
    return this.sendToUser(userId, {
      type: NotificationType.SYSTEM,
      title,
      message,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Send a drilling notification to a specific user
   */
  sendDrillingNotification(
    userId: string,
    title: string,
    message: string,
    data?: any,
  ): boolean {
    return this.sendToUser(userId, {
      type: NotificationType.DRILLING,
      title,
      message,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast a system notification to all users
   */
  broadcastSystemNotification(
    title: string,
    message: string,
    data?: any,
  ): void {
    this.broadcastToAll({
      type: NotificationType.SYSTEM,
      title,
      message,
      data,
      timestamp: new Date(),
    });
  }
}
