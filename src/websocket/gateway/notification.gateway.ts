import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { NotificationService } from '../services/notification.service';
import {
  AuthenticateUserDto,
  SendNotificationDto,
  BroadcastNotificationDto,
} from '../dto/notification.dto';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
@Injectable()
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) { }

  afterInit(server: Server) {
    this.notificationService.setServer(server);
    this.logger.log('Notification WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Send welcome message
    client.emit('connection', {
      status: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to notification system. Please authenticate.',
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove the connection from our manager
    this.connectionManager.removeUserConnection(client.id);
  }

  @SubscribeMessage('authenticate')
  async handleAuthentication(
    client: Socket,
    payload: AuthenticateUserDto,
  ): Promise<void> {
    try {
      // Validate JWT token
      const decodedToken = this.jwtService.verify(payload.token);

      // Ensure the token belongs to the user trying to authenticate
      if (decodedToken.sub !== payload.userId) {
        client.emit('error', {
          message: 'Authentication failed: User ID mismatch',
        });
        return;
      }

      // Register the connection
      this.connectionManager.registerUserConnection(payload.userId, client);

      // Notify client of successful authentication
      client.emit('authenticated', {
        status: 'success',
        userId: payload.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `User ${payload.userId} authenticated on socket ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Authentication error for socket ${client.id}: ${error.message}`,
      );
      client.emit('error', { message: 'Authentication failed: Invalid token' });
    }
  }

  @SubscribeMessage('sendNotification')
  async handleSendNotification(
    client: Socket,
    payload: SendNotificationDto,
  ): Promise<void> {
    try {
      // Get the authenticated user ID from the socket
      const senderUserId = this.connectionManager.getUserIdFromSocket(
        client.id,
      );

      if (!senderUserId) {
        client.emit('error', {
          message: 'You must be authenticated to send notifications',
        });
        return;
      }

      const success = this.notificationService.sendToUser(payload.userId, {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        timestamp: new Date(),
      });

      if (success) {
        client.emit('notificationSent', {
          status: 'success',
          recipient: payload.userId,
          timestamp: new Date().toISOString(),
        });
      } else {
        client.emit('notificationSent', {
          status: 'failed',
          recipient: payload.userId,
          reason: 'User not connected',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error sending notification: ${error.message}`);
      client.emit('error', { message: 'Failed to send notification' });
    }
  }

  @SubscribeMessage('broadcastNotification')
  async handleBroadcastNotification(
    client: Socket,
    payload: BroadcastNotificationDto,
  ): Promise<void> {
    try {
      // Get the authenticated user ID from the socket
      const senderUserId = this.connectionManager.getUserIdFromSocket(
        client.id,
      );

      if (!senderUserId) {
        client.emit('error', {
          message: 'You must be authenticated to broadcast notifications',
        });
        return;
      }

      // In a real application, you would check if the sender has permission to broadcast

      this.notificationService.broadcastToAll({
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        timestamp: new Date(),
      });

      client.emit('notificationBroadcast', {
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error broadcasting notification: ${error.message}`);
      client.emit('error', { message: 'Failed to broadcast notification' });
    }
  }

  @SubscribeMessage('getConnectionStats')
  handleGetConnectionStats(client: Socket): void {
    try {
      // Get the authenticated user ID from the socket
      const userId = this.connectionManager.getUserIdFromSocket(client.id);

      if (!userId) {
        client.emit('error', {
          message: 'You must be authenticated to access stats',
        });
        return;
      }

      const stats = this.connectionManager.getConnectionStats();
      client.emit('connectionStats', stats);
    } catch (error) {
      this.logger.error(`Error getting connection stats: ${error.message}`);
      client.emit('error', { message: 'Failed to get connection stats' });
    }
  }
}
