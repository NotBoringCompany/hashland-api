import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { UserConnection } from '../notification.interface';

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);

  // Map of userId to array of socket connections
  private userConnections = new Map<string, UserConnection[]>();

  // Map of socketId to userId for quick lookups
  private socketToUser = new Map<string, string>();

  // Map of socketId to drilling session ID
  private socketToDrillingSession = new Map<string, Types.ObjectId>();

  // Connection statistics
  private stats = {
    totalConnections: 0,
    activeUsers: 0,
    activeDrillingSessions: 0,
    peakConnections: 0,
  };

  /**
   * Register a new user connection with optional drilling session
   */
  registerUserConnection(
    userId: string,
    socket: Socket,
    drillingSessionId?: Types.ObjectId,
  ): void {
    try {
      const userIdStr = userId.toString();
      const connection: UserConnection = {
        socketId: socket.id,
        userId: new Types.ObjectId(userId),
        connectedAt: new Date(),
        drillingSessionId,
        isActive: true,
      };

      // Add to user connections map
      if (!this.userConnections.has(userIdStr)) {
        this.userConnections.set(userIdStr, []);
        this.stats.activeUsers++;
      }

      this.userConnections.get(userIdStr).push(connection);

      // Add to socket lookup map
      this.socketToUser.set(socket.id, userIdStr);

      // If drilling session is provided, track it
      if (drillingSessionId) {
        this.socketToDrillingSession.set(socket.id, drillingSessionId);
        this.stats.activeDrillingSessions++;
        this.logger.log(
          `User ${userId} started drilling session ${drillingSessionId} with socket ${socket.id}`,
        );
      }

      // Update stats
      this.stats.totalConnections++;
      if (this.stats.totalConnections > this.stats.peakConnections) {
        this.stats.peakConnections = this.stats.totalConnections;
      }

      this.logger.log(
        `User ${userId} connected with socket ${socket.id}. Total connections: ${this.stats.totalConnections}`,
      );
    } catch (error) {
      this.logger.error(`Error registering user connection: ${error.message}`);
      // Continue without failing
    }
  }

  /**
   * Remove a user connection
   */
  removeUserConnection(socketId: string): void {
    const userId = this.socketToUser.get(socketId);

    if (!userId) {
      this.logger.warn(`Attempted to remove unknown socket: ${socketId}`);
      return;
    }

    // Check if this was a drilling session
    if (this.socketToDrillingSession.has(socketId)) {
      this.socketToDrillingSession.delete(socketId);
      this.stats.activeDrillingSessions--;
    }

    // Remove from socket lookup map
    this.socketToUser.delete(socketId);

    // Remove from user connections map
    if (this.userConnections.has(userId)) {
      const connections = this.userConnections.get(userId);
      const updatedConnections = connections.filter(
        (conn) => conn.socketId !== socketId,
      );

      if (updatedConnections.length === 0) {
        this.userConnections.delete(userId);
        this.stats.activeUsers--;
      } else {
        this.userConnections.set(userId, updatedConnections);
      }
    }

    this.stats.totalConnections--;
    this.logger.log(
      `Socket ${socketId} disconnected. Total connections: ${this.stats.totalConnections}`,
    );
  }

  /**
   * Get all socket connections for a user
   */
  getUserConnections(userId: string): UserConnection[] {
    const userIdStr = userId.toString();
    return this.userConnections.get(userIdStr) || [];
  }

  /**
   * Get user ID from socket ID
   */
  getUserIdFromSocket(socketId: string): string | null {
    return this.socketToUser.get(socketId) || null;
  }

  /**
   * Get drilling session ID from socket ID
   */
  getDrillingSessionFromSocket(socketId: string): Types.ObjectId | null {
    return this.socketToDrillingSession.get(socketId) || null;
  }

  /**
   * Check if a user has any active connections
   */
  isUserConnected(userId: string): boolean {
    const userIdStr = userId.toString();
    return (
      this.userConnections.has(userIdStr) &&
      this.userConnections.get(userIdStr).length > 0
    );
  }

  /**
   * Check if a user is currently drilling
   */
  isUserDrilling(userId: string): boolean {
    const userIdStr = userId.toString();
    if (!this.userConnections.has(userIdStr)) return false;

    return this.userConnections
      .get(userIdStr)
      .some((conn) => !!conn.drillingSessionId);
  }

  /**
   * Get all users who are currently drilling
   */
  getDrillingUsers(): string[] {
    const drillingUsers = new Set<string>();

    this.socketToDrillingSession.forEach((_, socketId) => {
      const userId = this.socketToUser.get(socketId);
      if (userId) {
        drillingUsers.add(userId);
      }
    });

    return Array.from(drillingUsers);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      ...this.stats,
      currentTime: new Date(),
    };
  }
}
