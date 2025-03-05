import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DrillingSession } from '../../drills/schemas/drilling-session.schema';

interface DrillSessionPayload {
    operatorId: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/drilling-session',
})
@Injectable()
export class DrillingSessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(DrillingSessionGateway.name);
    private activeSessions = new Map<string, {
        sessionId: Types.ObjectId,
        operatorId: Types.ObjectId,
        startTime: Date,
        earnedHASH: number
    }>();

    @WebSocketServer()
    server: Server;

    constructor(
        @InjectModel(DrillingSession.name) private drillingSessionModel: Model<DrillingSession>
    ) { }

    async handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        // Note: At this point, we don't have the operatorId yet
        // The client needs to emit a 'startDrilling' event with the operatorId
    }

    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);

        // Check if this client has an active drilling session
        if (this.activeSessions.has(client.id)) {
            await this.endDrillingSession(client.id);
        }
    }

    @SubscribeMessage('startDrilling')
    async handleStartDrilling(client: Socket, payload: DrillSessionPayload): Promise<void> {
        try {
            // Validate payload
            if (!payload.operatorId) {
                client.emit('error', { message: 'operatorId is required' });
                return;
            }

            // Check if this client already has an active session
            if (this.activeSessions.has(client.id)) {
                client.emit('error', { message: 'You already have an active drilling session' });
                return;
            }

            const operatorId = new Types.ObjectId(payload.operatorId);
            const startTime = new Date();

            // Create a new drilling session in the database
            const newSession = await this.drillingSessionModel.create({
                operatorId,
                startTime,
                earnedHASH: 0, // Initial value
            });

            // Store the session info in memory for quick access
            this.activeSessions.set(client.id, {
                sessionId: newSession._id,
                operatorId,
                startTime,
                earnedHASH: 0
            });

            // Notify the client that drilling has started
            client.emit('drillingStarted', {
                sessionId: newSession._id,
                startTime,
                message: 'Drilling session started successfully'
            });

            this.logger.log(`Operator ${payload.operatorId} started drilling session ${newSession._id}`);
        } catch (error) {
            this.logger.error(`Error starting drilling session: ${error.message}`, error.stack);
            client.emit('error', { message: 'Failed to start drilling session' });
        }
    }

    @SubscribeMessage('stopDrilling')
    async handleStopDrilling(client: Socket): Promise<void> {
        try {
            await this.endDrillingSession(client.id);
        } catch (error) {
            this.logger.error(`Error stopping drilling session: ${error.message}`, error.stack);
            client.emit('error', { message: 'Failed to stop drilling session' });
        }
    }

    private async endDrillingSession(clientId: string): Promise<void> {
        // Check if this client has an active session
        if (!this.activeSessions.has(clientId)) {
            return;
        }

        const session = this.activeSessions.get(clientId);
        const endTime = new Date();

        // Update the session in the database
        await this.drillingSessionModel.findByIdAndUpdate(
            session.sessionId,
            {
                endTime,
                earnedHASH: session.earnedHASH
            }
        );

        // Calculate session duration in minutes
        const durationMs = endTime.getTime() - session.startTime.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);

        // Fixed: Get the client socket safely
        // In Socket.IO v4, we need to use a different approach to get the socket
        try {
            // Direct approach - use the client reference that was passed to the method
            const client = this.server.sockets.sockets.get(clientId);

            if (client) {
                client.emit('drillingStopped', {
                    sessionId: session.sessionId,
                    startTime: session.startTime,
                    endTime,
                    duration: durationSeconds,
                    earnedHASH: session.earnedHASH,
                    message: 'Drilling session ended successfully'
                });
            } else {
                // If we can't find the client socket, log it but continue
                this.logger.warn(`Could not find socket for client ${clientId} to notify about session end`);
            }
        } catch (error) {
            // If there's an error accessing the socket, log it but continue with cleanup
            this.logger.warn(`Error notifying client ${clientId} about session end: ${error.message}`);
        }

        // Remove the session from memory
        this.activeSessions.delete(clientId);

        this.logger.log(`Ended drilling session ${session.sessionId} after ${durationSeconds} seconds, earned HASH: ${session.earnedHASH}`);
    }
}