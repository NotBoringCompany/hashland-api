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

    // Connection statistics
    private stats = {
        totalConnections: 0,
        activeUsers: 0,
        peakConnections: 0,
    };

    /**
     * Register a new user connection
     */
    registerUserConnection(userId: string, socket: Socket): void {
        const userIdStr = userId.toString();
        const connection: UserConnection = {
            socketId: socket.id,
            userId: new Types.ObjectId(userId),
            connectedAt: new Date(),
        };

        // Add to user connections map
        if (!this.userConnections.has(userIdStr)) {
            this.userConnections.set(userIdStr, []);
            this.stats.activeUsers++;
        }

        this.userConnections.get(userIdStr).push(connection);

        // Add to socket lookup map
        this.socketToUser.set(socket.id, userIdStr);

        // Update stats
        this.stats.totalConnections++;
        if (this.stats.totalConnections > this.stats.peakConnections) {
            this.stats.peakConnections = this.stats.totalConnections;
        }

        this.logger.log(`User ${userId} connected with socket ${socket.id}. Total connections: ${this.stats.totalConnections}`);
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

        // Remove from socket lookup map
        this.socketToUser.delete(socketId);

        // Remove from user connections map
        if (this.userConnections.has(userId)) {
            const connections = this.userConnections.get(userId);
            const updatedConnections = connections.filter(conn => conn.socketId !== socketId);

            if (updatedConnections.length === 0) {
                this.userConnections.delete(userId);
                this.stats.activeUsers--;
            } else {
                this.userConnections.set(userId, updatedConnections);
            }
        }

        this.stats.totalConnections--;
        this.logger.log(`Socket ${socketId} disconnected. Total connections: ${this.stats.totalConnections}`);
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
     * Check if a user has any active connections
     */
    isUserConnected(userId: string): boolean {
        const userIdStr = userId.toString();
        return this.userConnections.has(userIdStr) && this.userConnections.get(userIdStr).length > 0;
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