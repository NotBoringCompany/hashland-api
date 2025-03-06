import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionManagerService } from './connection-manager.service';
import {
  NotificationPayload,
  NotificationType,
  OperatorNotification,
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
   * Send a notification to a specific operator
   */
  sendToOperator(
    operatorId: string,
    notification: NotificationPayload,
  ): boolean {
    try {
      if (!this.server) {
        this.logger.error('WebSocket server not initialized');
        return false;
      }

      const connections =
        this.connectionManager.getOperatorConnections(operatorId);

      if (!connections || connections.length === 0) {
        this.logger.warn(`No active connections for operator ${operatorId}`);
        return false;
      }

      const operatorNotification: OperatorNotification = {
        id: uuidv4(),
        operatorId: connections[0].operatorId, // Use the ObjectId from the connection
        read: false,
        ...notification,
        timestamp: notification.timestamp || new Date(),
      };

      // Send to all connections for this operator
      let sent = false;
      for (const connection of connections) {
        const connectedSockets = this.server.sockets.sockets;
        if (connectedSockets) {
          const socket = connectedSockets.get(connection.socketId);
          if (socket) {
            socket.emit('notification', operatorNotification);
            sent = true;
            this.logger.debug(
              `Notification sent to operator ${operatorId} via socket ${connection.socketId}`,
            );
          }
        }
      }

      return sent;
    } catch (error) {
      this.logger.error(
        `Error sending notification to operator ${operatorId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Broadcast a notification to all connected operators
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
        `Broadcast notification sent to all operators: ${notification.title}`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send a system notification to a specific operator
   */
  sendSystemNotification(
    operatorId: string,
    title: string,
    message: string,
    data?: any,
  ): boolean {
    return this.sendToOperator(operatorId, {
      type: NotificationType.SYSTEM,
      title,
      message,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Send a drilling notification to a specific operator
   */
  sendDrillingNotification(
    operatorId: string,
    title: string,
    message: string,
    data?: any,
  ): boolean {
    return this.sendToOperator(operatorId, {
      type: NotificationType.DRILLING,
      title,
      message,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast a system notification to all operators
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
