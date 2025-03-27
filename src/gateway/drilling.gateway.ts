import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import {
  DrillingSessionService,
  DrillingSessionStatus,
} from 'src/drills/drilling-session.service';
import { OperatorService } from 'src/operators/operator.service';
import { Types } from 'mongoose';
import { RedisService } from 'src/common/redis.service';
import { JwtService } from '@nestjs/jwt';
import {
  DrillingStartedResponse,
  DrillingInfoResponse,
  DrillingStoppingResponse,
  DrillingStoppedResponse,
  DrillingErrorResponse,
  DrillingStatusResponse,
  OnlineOperatorUpdateResponse,
  BroadcastStopDrillingPayload,
  FuelStatusResponse,
} from './drilling.gateway.types';
import { DrillingCycle } from 'src/drills/schemas/drilling-cycle.schema';

/**
 * WebSocket Gateway for handling real-time drilling updates.
 *
 * This gateway:
 * - Tracks online operators (players connected via WebSocket).
 * - Emits real-time updates to all connected clients when an operator connects or disconnects.
 * - Handles starting and stopping drilling sessions.
 * - Automatically stops drilling when operators run out of fuel or disconnect.
 * - Sends fuel updates to operators when their fuel is depleted or replenished.
 */
@WebSocketGateway({
  cors: { origin: '*' }, // ✅ Allow WebSocket connections from any frontend
})
export class DrillingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(DrillingGateway.name);

  // Redis keys for storing operator data
  private readonly redisOnlineOperatorsKey =
    'hashland-drilling:onlineOperators';
  private readonly redisActiveDrillingOperatorsKey =
    'hashland-drilling:activeDrillingOperators';
  private readonly redisRecentCycleRewardsKey =
    'hashland-drilling:recent-cycle-rewards';
  private readonly redisOperatorSocketsKey =
    'hashland-drilling:operator-sockets';

  /**
   * Keeps track of online operators.
   * - Uses a `Set<string>` to store unique operator IDs.
   * - Ensures quick lookups, insertions, and deletions.
   */
  private onlineOperators = new Set<string>();

  /**
   * Keeps track of actively drilling operators.
   * Maps operator IDs to their primary socket ID.
   */
  private activeDrillingOperators = new Map<string, string>();

  /**
   * Maps operator IDs to all of their connected socket IDs.
   * Allows operators to connect from multiple devices simultaneously.
   */
  private operatorSockets = new Map<string, Set<string>>();

  constructor(
    private readonly drillingSessionService: DrillingSessionService,
    private readonly operatorService: OperatorService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Initializes the gateway by loading operator data from Redis.
   */
  async onModuleInit() {
    await this.loadOperatorsFromRedis();
  }

  /**
   * Loads operator data from Redis when the server starts.
   */
  private async loadOperatorsFromRedis() {
    try {
      // Load online operators
      const onlineOperatorsJson = await this.redisService.get(
        this.redisOnlineOperatorsKey,
      );
      if (onlineOperatorsJson) {
        const onlineOperatorsArray = JSON.parse(onlineOperatorsJson);
        this.onlineOperators = new Set(onlineOperatorsArray);
        this.logger.log(
          `Loaded ${this.onlineOperators.size} online operators from Redis`,
        );
      }

      // Load active drilling operators
      const activeDrillingOperatorsJson = await this.redisService.get(
        this.redisActiveDrillingOperatorsKey,
      );
      if (activeDrillingOperatorsJson) {
        const activeDrillingOperatorsArray = JSON.parse(
          activeDrillingOperatorsJson,
        );
        this.activeDrillingOperators = new Map(activeDrillingOperatorsArray);
        this.logger.log(
          `Loaded ${this.activeDrillingOperators.size} active drilling operators from Redis`,
        );
      }

      // Load operator sockets map
      const operatorSocketsJson = await this.redisService.get(
        this.redisOperatorSocketsKey,
      );
      if (operatorSocketsJson) {
        const operatorSocketsArray = JSON.parse(operatorSocketsJson);
        // Convert array format back to Map of Sets
        this.operatorSockets = new Map();
        for (const [operatorId, socketIds] of operatorSocketsArray) {
          this.operatorSockets.set(operatorId, new Set(socketIds));
        }
        this.logger.log(
          `Loaded operator sockets for ${this.operatorSockets.size} operators from Redis`,
        );
      }
    } catch (error) {
      this.logger.error(`Error loading operators from Redis: ${error.message}`);
    }
  }

  /**
   * Saves online operators to Redis.
   */
  private async saveOnlineOperatorsToRedis() {
    try {
      const onlineOperatorsArray = Array.from(this.onlineOperators);
      await this.redisService.set(
        this.redisOnlineOperatorsKey,
        JSON.stringify(onlineOperatorsArray),
      );
    } catch (error) {
      this.logger.error(
        `❌ Error saving online operators to Redis: ${error.message}`,
      );
      // Log the stack trace for better debugging
      this.logger.error(error.stack);
    }
  }

  /**
   * Saves active drilling operators to Redis.
   */
  private async saveActiveDrillingOperatorsToRedis() {
    try {
      const activeDrillingOperatorsArray = Array.from(
        this.activeDrillingOperators.entries(),
      );
      await this.redisService.set(
        this.redisActiveDrillingOperatorsKey,
        JSON.stringify(activeDrillingOperatorsArray),
      );
    } catch (error) {
      this.logger.error(
        `❌ Error saving active drilling operators to Redis: ${error.message}`,
      );
      // Log the stack trace for better debugging
      this.logger.error(error.stack);
    }
  }

  /**
   * Saves operator sockets map to Redis.
   */
  private async saveOperatorSocketsToRedis() {
    try {
      // Convert Map<string, Set<string>> to Array format for JSON serialization
      const operatorSocketsArray = Array.from(
        this.operatorSockets.entries(),
      ).map(([operatorId, socketSet]) => [operatorId, Array.from(socketSet)]);

      await this.redisService.set(
        this.redisOperatorSocketsKey,
        JSON.stringify(operatorSocketsArray),
      );
    } catch (error) {
      this.logger.error(
        `❌ Error saving operator sockets to Redis: ${error.message}`,
      );
      // Log the stack trace for better debugging
      this.logger.error(error.stack);
    }
  }

  /**
   * Handles a new WebSocket connection.
   * - Authenticates the operator using JWT.
   * - Adds the operator to the online tracking list.
   * - Emits an updated online operator count.
   *
   * @param client The connected WebSocket client.
   */
  async handleConnection(client: Socket) {
    try {
      // Authenticate the client using JWT
      const operatorId = await this.authenticateClient(client);

      if (!operatorId) {
        this.logger.warn(`Client ${client.id} failed authentication`);
        client.disconnect();
        return;
      }

      // Store the authenticated operatorId in the client data for easy access
      client.data.operatorId = operatorId;

      // Add to online operators
      this.onlineOperators.add(operatorId);

      // Add socket to operator sockets map
      if (!this.operatorSockets.has(operatorId)) {
        this.operatorSockets.set(operatorId, new Set<string>());
      }
      this.operatorSockets.get(operatorId).add(client.id);

      // Save to Redis with error handling
      try {
        await Promise.all([
          this.saveOnlineOperatorsToRedis(),
          this.saveOperatorSocketsToRedis(),
        ]);
      } catch (redisError) {
        this.logger.error(
          `Redis error during connection: ${redisError.message}`,
        );
        // Continue execution despite Redis errors - local state is still updated
      }

      this.logger.log(
        `🔗 Operator Connected: ${operatorId} (Socket: ${client.id}, Total Connections: ${this.operatorSockets.get(operatorId).size})`,
      );

      try {
        this.broadcastOnlineOperators(); // Notify all clients
      } catch (broadcastError) {
        this.logger.error(
          `Error broadcasting online operators: ${broadcastError.message}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`);
      this.logger.error(error.stack);
      try {
        client.disconnect();
      } catch (disconnectError) {
        this.logger.error(
          `Error disconnecting client: ${disconnectError.message}`,
        );
      }
    }
  }

  /**
   * Handles a WebSocket disconnection.
   * - Removes the operator from the online tracking list if all their connections are closed.
   * - Automatically stops any active drilling session if the primary socket disconnects.
   * - Emits an updated online operator count.
   *
   * @param client The disconnected WebSocket client.
   */
  async handleDisconnect(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (operatorId) {
        // Remove this socket from operator sockets
        if (this.operatorSockets.has(operatorId)) {
          const sockets = this.operatorSockets.get(operatorId);
          sockets.delete(client.id);

          // Check if this was the primary socket for drilling
          const isPrimarySocket =
            this.activeDrillingOperators.get(operatorId) === client.id;

          // If this was the primary socket and operator was drilling, handle it
          if (isPrimarySocket && this.activeDrillingOperators.has(operatorId)) {
            // If there are other sockets for this operator, pick one as the new primary
            if (sockets.size > 0) {
              const newPrimarySocket = Array.from(sockets)[0];
              this.activeDrillingOperators.set(operatorId, newPrimarySocket);
              this.logger.log(
                `🔄 Primary socket changed for operator ${operatorId} from ${client.id} to ${newPrimarySocket}`,
              );
            } else {
              // No other connections, stop drilling
              try {
                await this.stopDrilling(client);
              } catch (stopError) {
                this.logger.error(
                  `Error stopping drilling during disconnect: ${stopError.message}`,
                );
              }
            }
          }

          // If no more sockets, remove operator from online list
          if (sockets.size === 0) {
            this.operatorSockets.delete(operatorId);
            this.onlineOperators.delete(operatorId);
            this.logger.log(
              `❌ Operator Disconnected: ${operatorId} (All connections closed)`,
            );
          } else {
            this.logger.log(
              `🔌 Socket Disconnected: ${client.id} for operator ${operatorId} (Remaining connections: ${sockets.size})`,
            );
          }

          // Save changes to Redis with error handling
          try {
            await Promise.all([
              this.saveOnlineOperatorsToRedis(),
              this.saveOperatorSocketsToRedis(),
              this.saveActiveDrillingOperatorsToRedis(),
            ]);
          } catch (redisError) {
            this.logger.error(
              `Redis error during disconnect: ${redisError.message}`,
            );
            // Continue execution despite Redis errors - local state is still updated
          }

          // Update online counts for all clients
          try {
            this.broadcastOnlineOperators();
          } catch (broadcastError) {
            this.logger.error(
              `Error broadcasting online operators: ${broadcastError.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * Returns the current number of online operators.
   * - This is used for real-time monitoring of active users.
   *
   * @returns The count of online operators.
   */
  getOnlineOperatorCount(): number {
    return this.onlineOperators.size;
  }

  /**
   * Returns the current number of actively drilling operators.
   *
   * @returns The count of actively drilling operators.
   */
  getActiveDrillingOperatorCount(): number {
    return this.activeDrillingOperators.size;
  }

  /**
   * Gets all socket IDs for a specific operator.
   *
   * @param operatorId The operator ID to look up
   * @returns Array of socket IDs if found, empty array otherwise
   */
  getAllSocketsForOperator(operatorId: string): string[] {
    if (this.operatorSockets.has(operatorId)) {
      return Array.from(this.operatorSockets.get(operatorId));
    }
    return [];
  }

  /**
   * Gets the primary socket ID for a specific operator.
   *
   * @param operatorId The operator ID to look up
   * @returns The primary socket ID if found, undefined otherwise
   */
  getSocketIdForOperator(operatorId: string): string | undefined {
    return this.activeDrillingOperators.get(operatorId);
  }

  /**
   * Emits the updated online operator count to all connected clients.
   * - Helps frontend display real-time active user count.
   */
  private broadcastOnlineOperators() {
    this.server.emit('online-operator-update', {
      onlineOperatorCount: this.getOnlineOperatorCount(),
      activeDrillingOperatorCount: this.getActiveDrillingOperatorCount(),
    } as OnlineOperatorUpdateResponse);
  }

  /**
   * WebSocket event handler for starting a drilling session.
   *
   * @param client The WebSocket client.
   * @returns Success/failure message.
   */
  @SubscribeMessage('start-drilling')
  async startDrilling(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (!operatorId) {
        client.emit('drilling-error', {
          message: 'Authentication required',
        } as DrillingErrorResponse);
        return;
      }

      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // Check if operator has enough fuel
      const hasEnoughFuel = await this.operatorService.hasEnoughFuel(objectId);
      if (!hasEnoughFuel) {
        client.emit('drilling-error', {
          message: 'Not enough fuel to start drilling',
        } as DrillingErrorResponse);
        return;
      }

      // Start drilling session
      const response =
        await this.drillingSessionService.startDrillingSession(objectId);

      if (response.status === 200) {
        // Track this operator as actively drilling with this socket as the primary
        this.activeDrillingOperators.set(operatorId, client.id);
        await this.saveActiveDrillingOperatorsToRedis();

        // Send drilling started response to all connected sockets for this operator
        const allSockets = this.getAllSocketsForOperator(operatorId);
        const drillingStarted = {
          message: 'Drilling session started successfully',
          status: DrillingSessionStatus.WAITING,
        } as DrillingStartedResponse;

        const drillingInfo = {
          message:
            'Your drilling session will be activated at the start of the next cycle',
        } as DrillingInfoResponse;

        for (const socketId of allSockets) {
          if (this.server.sockets.sockets.has(socketId)) {
            this.server.to(socketId).emit('drilling-started', drillingStarted);
            this.server.to(socketId).emit('drilling-info', drillingInfo);
          }
        }

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `🔄 Operator ${operatorId} started drilling in waiting status (primary socket: ${client.id})`,
        );
      } else {
        client.emit('drilling-error', {
          message: response.message,
        } as DrillingErrorResponse);
      }
    } catch (error) {
      this.logger.error(`Error starting drilling: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to start drilling: ${error.message}`,
      } as DrillingErrorResponse);
    }
  }

  /**
   * WebSocket event handler for requesting the current drilling session status.
   *
   * @param client The WebSocket client.
   * @returns Current drilling session status.
   */
  @SubscribeMessage('get-drilling-status')
  async getDrillingStatus(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (!operatorId) {
        client.emit('drilling-error', {
          message: 'Authentication required',
        } as DrillingErrorResponse);
        return;
      }

      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // Get the current session from Redis
      const session =
        await this.drillingSessionService.getOperatorSession(objectId);

      // Get current cycle number for context
      const cycleNumberStr = await this.redisService.get(
        'drilling-cycle:current',
      );
      const currentCycleNumber = cycleNumberStr
        ? parseInt(cycleNumberStr, 10)
        : 0;

      if (session) {
        const statusResponse = {
          status: session.status,
          startTime: session.startTime,
          earnedHASH: session.earnedHASH,
          cycleStarted: session.cycleStarted,
          cycleEnded: session.cycleEnded,
          currentCycleNumber,
        } as DrillingStatusResponse;

        client.emit('drilling-status', statusResponse);
        this.logger.log(
          `📊 Sent drilling status to operator ${operatorId} on socket ${client.id}`,
        );
      } else {
        client.emit('drilling-status', {
          status: 'inactive',
          message: 'No active drilling session found',
        } as DrillingStatusResponse);
      }
    } catch (error) {
      this.logger.error(`Error getting drilling status: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to get drilling status: ${error.message}`,
      } as DrillingErrorResponse);
    }
  }

  /**
   * WebSocket event handler for requesting the current fuel status.
   *
   * @param client The WebSocket client.
   * @returns Current fuel status.
   */
  @SubscribeMessage('get-fuel-status')
  async getFuelStatus(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (!operatorId) {
        client.emit('drilling-error', {
          message: 'Authentication required',
        } as DrillingErrorResponse);
        return;
      }

      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // Get the operator's fuel status
      const operator =
        await this.operatorService.getOperatorFuelStatus(objectId);

      if (operator) {
        // Calculate fuel percentage
        const fuelPercentage = (operator.currentFuel / operator.maxFuel) * 100;

        client.emit('fuel-status', {
          currentFuel: operator.currentFuel,
          maxFuel: operator.maxFuel,
          fuelPercentage: Math.round(fuelPercentage * 10) / 10, // Round to 1 decimal place
        } as FuelStatusResponse);

        this.logger.log(
          `⛽ Sent fuel status to operator ${operatorId} on socket ${client.id}`,
        );
      } else {
        client.emit('drilling-error', {
          message: 'Failed to get fuel status',
        } as DrillingErrorResponse);
      }
    } catch (error) {
      this.logger.error(`Error getting fuel status: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to get fuel status: ${error.message}`,
      } as DrillingErrorResponse);
    }
  }

  /**
   * WebSocket event handler for stopping a drilling session.
   *
   * @param client The WebSocket client.
   * @returns Success/failure message.
   */
  @SubscribeMessage('stop-drilling')
  async stopDrilling(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (!operatorId) {
        client.emit('drilling-error', {
          message: 'Authentication required',
        } as DrillingErrorResponse);
        return;
      }

      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // Get current cycle number
      const cycleNumberStr = await this.redisService.get(
        'drilling-cycle:current',
      );
      const cycleNumber = cycleNumberStr ? parseInt(cycleNumberStr, 10) : 0;

      // Initiate stopping the drilling session
      const response =
        await this.drillingSessionService.initiateStopDrillingSession(
          objectId,
          cycleNumber,
        );

      if (response.status === 200) {
        // Get all connected sockets for this operator
        const allSockets = this.getAllSocketsForOperator(operatorId);
        const stoppingMessage = {
          message:
            'Drilling session stopping initiated. Will complete at end of cycle.',
          status: DrillingSessionStatus.STOPPING,
        } as DrillingStoppingResponse;

        // Notify all connected sockets for this operator
        for (const socketId of allSockets) {
          if (this.server.sockets.sockets.has(socketId)) {
            this.server.to(socketId).emit('drilling-stopping', stoppingMessage);
          }
        }

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `🛑 Operator ${operatorId} initiated stopping drilling on socket ${client.id} (total connections: ${allSockets.length})`,
        );
      } else {
        client.emit('drilling-error', {
          message: response.message,
        } as DrillingErrorResponse);
      }
    } catch (error) {
      this.logger.error(`Error stopping drilling: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to stop drilling: ${error.message}`,
      } as DrillingErrorResponse);
    }
  }

  /**
   * Stops drilling for an operator who has run out of fuel.
   * Called by the OperatorService when fuel drops below threshold.
   *
   * @param operatorId The ID of the operator who ran out of fuel.
   */
  async stopDrillingDueToFuelDepletion(operatorId: Types.ObjectId) {
    const operatorIdStr = operatorId.toString();

    // Check if this operator is actively drilling
    if (this.activeDrillingOperators.has(operatorIdStr)) {
      try {
        // Get current cycle number
        const cycleNumberStr = await this.redisService.get(
          'drilling-cycle:current',
        );
        const cycleNumber = cycleNumberStr ? parseInt(cycleNumberStr, 10) : 0;

        // Force end the drilling session
        await this.drillingSessionService.forceEndDrillingSession(
          operatorId,
          cycleNumber,
        );

        // Get all connected sockets for this operator
        const allSockets = this.getAllSocketsForOperator(operatorIdStr);

        // Remove from active drilling operators
        this.activeDrillingOperators.delete(operatorIdStr);
        await this.saveActiveDrillingOperatorsToRedis();

        // Notify all connected sockets
        const stoppedMessage = {
          message: 'Drilling stopped due to insufficient fuel',
          reason: 'fuel_depleted',
          status: DrillingSessionStatus.COMPLETED,
        } as DrillingStoppedResponse;

        for (const socketId of allSockets) {
          if (this.server.sockets.sockets.has(socketId)) {
            this.server.to(socketId).emit('drilling-stopped', stoppedMessage);
          }
        }

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `⚠️ Operator ${operatorIdStr} stopped drilling due to fuel depletion (notified on ${allSockets.length} connections)`,
        );
      } catch (error) {
        this.logger.error(
          `Error stopping drilling due to fuel depletion for ${operatorIdStr}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Broadcasts stop drilling event to multiple operators due to fuel depletion.
   *
   * @param operatorIds Array of operator IDs to stop drilling
   * @param payload The payload to emit to clients
   */
  async broadcastStopDrilling(
    operatorIds: Types.ObjectId[],
    payload: BroadcastStopDrillingPayload,
  ) {
    // Get current cycle number
    const cycleNumberStr = await this.redisService.get(
      'drilling-cycle:current',
    );
    const cycleNumber = cycleNumberStr ? parseInt(cycleNumberStr, 10) : 0;

    for (const operatorId of operatorIds) {
      const operatorIdStr = operatorId.toString();

      // Check if this operator is actively drilling
      if (this.activeDrillingOperators.has(operatorIdStr)) {
        try {
          // Force end the drilling session
          await this.drillingSessionService.forceEndDrillingSession(
            operatorId,
            cycleNumber,
          );

          // Get all connected sockets for this operator
          const allSockets = this.getAllSocketsForOperator(operatorIdStr);

          // Remove from active drilling operators
          this.activeDrillingOperators.delete(operatorIdStr);

          // Notify all connected sockets
          const stoppedMessage = {
            ...payload,
            operatorId: operatorIdStr,
            status: DrillingSessionStatus.COMPLETED,
          } as DrillingStoppedResponse;

          for (const socketId of allSockets) {
            if (this.server.sockets.sockets.has(socketId)) {
              this.server.to(socketId).emit('drilling-stopped', stoppedMessage);
            }
          }

          this.logger.log(
            `⚠️ Operator ${operatorIdStr} stopped drilling due to fuel depletion (notified on ${allSockets.length} connections)`,
          );
        } catch (error) {
          this.logger.error(
            `Error stopping drilling due to fuel depletion for ${operatorIdStr}: ${error.message}`,
          );
        }
      }
    }

    // Save active drilling operators to Redis and broadcast once after processing all operators
    await this.saveActiveDrillingOperatorsToRedis();
    this.broadcastOnlineOperators();
  }

  /**
   * Authenticates a client using JWT from the authorization header.
   *
   * @param client The WebSocket client to authenticate.
   * @returns The operator ID if authentication is successful, null otherwise.
   */
  private async authenticateClient(client: Socket): Promise<string | null> {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} has no token`);
        return null;
      }

      const payload = this.jwtService.verify(token);

      if (!payload || !payload.operatorId) {
        this.logger.warn(`Client ${client.id} has invalid token payload`);
        return null;
      }

      return payload.operatorId.toString();
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      return null;
    }
  }

  /**
   * WebSocket event handler for requesting the latest cycle.
   *
   * @param client The WebSocket client.
   */
  @SubscribeMessage('get-latest-cycle')
  async getLatestCycle(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (!operatorId) {
        client.emit('drilling-error', {
          message: 'Authentication required',
        } as DrillingErrorResponse);
        return;
      }

      // Get recent rewards from Redis with proper error handling
      try {
        const latestCycle = await this.getLatestCycles();

        // Send the rewards to the client
        client.emit('latest-cycle', latestCycle);

        this.logger.log(
          `📊 Sent latest cycle to operator ${operatorId} on socket ${client.id}`,
        );
      } catch (redisError) {
        this.logger.error(
          `Redis error fetching latest cycle: ${redisError.message}`,
        );
        // Send an empty array as fallback
        client.emit('latest-cycle', []);
      }
    } catch (error) {
      this.logger.error(`Error getting latest cycle: ${error.message}`);
      this.logger.error(error.stack);
      client.emit('drilling-error', {
        message: `Failed to get latest cycle: ${error.message}`,
      } as DrillingErrorResponse);
    }
  }

  /**
   * Retrieves the latest 5 drilling cycles from Redis.
   *
   * @returns Array of the latest 5 drilling cycles
   */
  async getLatestCycles(): Promise<DrillingCycle[]> {
    try {
      const recentCyclesStr = await this.redisService.get(
        this.redisRecentCycleRewardsKey,
      );

      if (!recentCyclesStr) {
        return [];
      }

      return JSON.parse(recentCyclesStr);
    } catch (error) {
      this.logger.error(
        `❌ Error retrieving recent drilling cycles from Redis: ${error.message}`,
      );
      this.logger.error(error.stack);
      // Return empty array instead of failing
      return [];
    }
  }

  /**
   * Stores drilling cycle data in Redis for later retrieval.
   * Maintains a list of the latest 5 drilling cycles.
   */
  async storeLatestCycleInRedis(drillingCycle: DrillingCycle): Promise<void> {
    try {
      // Get existing cycles list
      const existingCyclesStr = await this.redisService.get(
        this.redisRecentCycleRewardsKey,
      );
      let latestCycles: DrillingCycle[] = [];

      if (existingCyclesStr) {
        try {
          latestCycles = JSON.parse(existingCyclesStr);
        } catch (parseError) {
          this.logger.error(
            `❌ Error parsing existing cycles JSON: ${parseError.message}`,
          );
          // Continue with an empty array if parsing fails
        }
      }

      // Add new cycle to the beginning of the array
      latestCycles.unshift(drillingCycle);

      // Keep only the latest 5 cycles
      if (latestCycles.length > 5) {
        latestCycles = latestCycles.slice(0, 5);
      }

      // Store back in Redis with 24-hour expiry
      await this.redisService.set(
        this.redisRecentCycleRewardsKey,
        JSON.stringify(latestCycles),
        24 * 60 * 60, // 24 hours in seconds
      );

      this.logger.log(
        `💾 Stored drilling cycle #${drillingCycle.cycleNumber} in Redis`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error storing drilling cycle in Redis: ${error.message}`,
      );
      this.logger.error(error.stack);
      // Log but don't throw - this operation should not disrupt the main flow
    }
  }
}
