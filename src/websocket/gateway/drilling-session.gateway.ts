import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DrillingSession } from '../../drills/schemas/drilling-session.schema';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../services/notification.service';

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
        @InjectModel(DrillingSession.name) private drillingSessionModel: Model<DrillingSession>,
        private readonly connectionManager: ConnectionManagerService,
        private readonly jwtService: JwtService,
        private readonly notificationService: NotificationService
    ) { }

    async handleConnection(client: Socket) {
        this.logger.log(`Client connected to drilling session: ${client.id}`);

        try {
            // Extract token from headers
            // const authHeader = client.handshake.headers.authorization;
            // if (!authHeader) {
            //     this.logger.warn(`Client ${client.id} has no authorization header`);
            //     client.disconnect();
            //     return;
            // }

            // const token = authHeader.split(' ')[1];
            // const payload = this.jwtService.verify(token);

            // if (!payload || !payload.sub) {
            //     this.logger.warn(`Client ${client.id} has invalid token payload`);
            //     client.disconnect();
            //     return;
            // }

            // We don't register the connection here yet, as we want to wait for startDrilling
            // This just validates the connection is authenticated

            this.logger.log(`Client ${client.id} authenticated as user`);
        } catch (error) {
            this.logger.error(`WebSocket authentication error: ${error.message}`, error.stack);
            client.disconnect();
        }
    }

    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected from drilling session: ${client.id}`);

        // Check if this client has an active drilling session
        if (this.activeSessions.has(client.id)) {
            await this.endDrillingSession(client.id);
        }

        // Remove from connection manager if they were registered
        this.connectionManager.removeUserConnection(client.id);
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

            // Ensure operatorId is a valid ObjectId
            let operatorId: Types.ObjectId;
            try {
                operatorId = new Types.ObjectId(payload.operatorId);
            } catch (error) {
                client.emit('error', { message: 'Invalid operatorId format' });
                return;
            }

            const startTime = new Date();

            // Create a new drilling session in the database
            const newSession = await this.drillingSessionModel.create({
                operatorId: operatorId,
                startTime: startTime,
                earnedHASH: 0 // Initial value
            });

            // Store the session info in memory for quick access
            this.activeSessions.set(client.id, {
                sessionId: newSession._id,
                operatorId: operatorId,
                startTime: startTime,
                earnedHASH: 0
            });

            // Register the user connection with the connection manager
            this.connectionManager.registerUserConnection(payload.operatorId, client, newSession._id);

            // Send a notification to the user
            try {
                await this.notificationService.sendDrillingNotification(
                    payload.operatorId,
                    'Drilling Started',
                    'Your drilling session has started successfully.',
                    {
                        sessionId: newSession._id.toString(),
                        startTime: startTime.toISOString()
                    }
                );
            } catch (notificationError) {
                this.logger.warn(`Failed to send notification: ${notificationError.message}`);
                // Continue execution even if notification fails
            }

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
            // Check if this client has an active session
            if (!this.activeSessions.has(client.id)) {
                client.emit('error', { message: 'No active drilling session found' });
                return;
            }

            const session = this.activeSessions.get(client.id);
            await this.endDrillingSession(client.id);

            // Send a notification to the user
            await this.notificationService.sendDrillingNotification(
                session.operatorId.toString(),
                'Drilling Completed',
                'Your drilling session has ended successfully.',
                {
                    sessionId: session.sessionId.toString(),
                    earnedHASH: session.earnedHASH
                }
            );

            client.emit('drillingStopped', {
                message: 'Drilling session ended successfully',
                earnedHASH: session.earnedHASH
            });
        } catch (error) {
            this.logger.error(`Error stopping drilling session: ${error.message}`, error.stack);
            client.emit('error', { message: 'Failed to stop drilling session' });
        }
    }

    private async endDrillingSession(clientId: string): Promise<void> {
        const session = this.activeSessions.get(clientId);
        if (!session) return;

        const endTime = new Date();
        const duration = endTime.getTime() - session.startTime.getTime();

        // Update the session in the database
        await this.drillingSessionModel.findByIdAndUpdate(session.sessionId, {
            endTime,
            duration, // in milliseconds
            earnedHASH: session.earnedHASH
        });

        // Remove from active sessions
        this.activeSessions.delete(clientId);

        this.logger.log(`Drilling session ${session.sessionId} ended after ${duration}ms, earned ${session.earnedHASH} HASH`);
    }
}