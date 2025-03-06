import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { OperatorConnection } from '../notification.interface';

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);

  // Map of operatorId to array of socket connections
  private operatorConnections = new Map<string, OperatorConnection[]>();

  // Map of socketId to operatorId for quick lookups
  private socketToOperator = new Map<string, string>();

  // Map of socketId to drilling session ID
  private socketToDrillingSession = new Map<string, Types.ObjectId>();

  // Connection statistics
  private stats = {
    totalConnections: 0,
    activeOperators: 0,
    activeDrillingSessions: 0,
    peakConnections: 0,
  };

  /**
   * Register a new operator connection with optional drilling session
   */
  registerOperatorConnection(
    operatorId: string,
    socket: Socket,
    drillingSessionId?: Types.ObjectId,
  ): void {
    try {
      const operatorIdStr = operatorId.toString();
      const connection: OperatorConnection = {
        socketId: socket.id,
        operatorId: new Types.ObjectId(operatorId),
        connectedAt: new Date(),
        drillingSessionId,
        isActive: true,
      };

      // Add to operator connections map
      if (!this.operatorConnections.has(operatorIdStr)) {
        this.operatorConnections.set(operatorIdStr, []);
        this.stats.activeOperators++;
      }

      this.operatorConnections.get(operatorIdStr).push(connection);

      // Add to socket lookup map
      this.socketToOperator.set(socket.id, operatorIdStr);

      // If drilling session is provided, track it
      if (drillingSessionId) {
        this.socketToDrillingSession.set(socket.id, drillingSessionId);
        this.stats.activeDrillingSessions++;
        this.logger.log(
          `Operator ${operatorId} started drilling session ${drillingSessionId} with socket ${socket.id}`,
        );
      }

      // Update stats
      this.stats.totalConnections++;
      if (this.stats.totalConnections > this.stats.peakConnections) {
        this.stats.peakConnections = this.stats.totalConnections;
      }

      this.logger.log(
        `Operator ${operatorId} connected with socket ${socket.id}. Total connections: ${this.stats.totalConnections}`,
      );
    } catch (error) {
      this.logger.error(
        `Error registering operator connection: ${error.message}`,
      );
      // Continue without failing
    }
  }

  /**
   * Remove a operator connection
   */
  removeOperatorConnection(socketId: string): void {
    const operatorId = this.socketToOperator.get(socketId);

    if (!operatorId) {
      this.logger.warn(`Attempted to remove unknown socket: ${socketId}`);
      return;
    }

    // Check if this was a drilling session
    if (this.socketToDrillingSession.has(socketId)) {
      this.socketToDrillingSession.delete(socketId);
      this.stats.activeDrillingSessions--;
    }

    // Remove from socket lookup map
    this.socketToOperator.delete(socketId);

    // Remove from operator connections map
    if (this.operatorConnections.has(operatorId)) {
      const connections = this.operatorConnections.get(operatorId);
      const updatedConnections = connections.filter(
        (conn) => conn.socketId !== socketId,
      );

      if (updatedConnections.length === 0) {
        this.operatorConnections.delete(operatorId);
        this.stats.activeOperators--;
      } else {
        this.operatorConnections.set(operatorId, updatedConnections);
      }
    }

    this.stats.totalConnections--;
    this.logger.log(
      `Socket ${socketId} disconnected. Total connections: ${this.stats.totalConnections}`,
    );
  }

  /**
   * Get all socket connections for a operator
   */
  getOperatorConnections(operatorId: string): OperatorConnection[] {
    const operatorIdStr = operatorId.toString();
    return this.operatorConnections.get(operatorIdStr) || [];
  }

  /**
   * Get operator ID from socket ID
   */
  getOperatorIdFromSocket(socketId: string): string | null {
    return this.socketToOperator.get(socketId) || null;
  }

  /**
   * Get drilling session ID from socket ID
   */
  getDrillingSessionFromSocket(socketId: string): Types.ObjectId | null {
    return this.socketToDrillingSession.get(socketId) || null;
  }

  /**
   * Check if a operator has any active connections
   */
  isOperatorConnected(operatorId: string): boolean {
    const operatorIdStr = operatorId.toString();
    return (
      this.operatorConnections.has(operatorIdStr) &&
      this.operatorConnections.get(operatorIdStr).length > 0
    );
  }

  /**
   * Check if a operator is currently drilling
   */
  isOperatorDrilling(operatorId: string): boolean {
    const operatorIdStr = operatorId.toString();
    if (!this.operatorConnections.has(operatorIdStr)) return false;

    return this.operatorConnections
      .get(operatorIdStr)
      .some((conn) => !!conn.drillingSessionId);
  }

  /**
   * Get all operators who are currently drilling
   */
  getDrillingOperators(): string[] {
    const drillingOperators = new Set<string>();

    this.socketToDrillingSession.forEach((_, socketId) => {
      const operatorId = this.socketToOperator.get(socketId);
      if (operatorId) {
        drillingOperators.add(operatorId);
      }
    });

    return Array.from(drillingOperators);
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
