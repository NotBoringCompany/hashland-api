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

/**
 * WebSocket Gateway for handling real-time drilling updates.
 *
 * This gateway:
 * - Tracks online operators (players connected via WebSocket).
 * - Emits real-time updates to all connected clients when an operator connects or disconnects.
 * - Handles starting and stopping drilling sessions.
 * - Automatically stops drilling when operators run out of fuel or disconnect.
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
  private readonly redisOnlineOperatorsKey = 'drilling:onlineOperators';
  private readonly redisActiveDrillingOperatorsKey =
    'drilling:activeDrillingOperators';

  /**
   * Keeps track of online operators.
   * - Uses a `Set<string>` to store unique operator IDs.
   * - Ensures quick lookups, insertions, and deletions.
   */
  private onlineOperators = new Set<string>();

  /**
   * Keeps track of actively drilling operators.
   * Maps operator IDs to their socket IDs.
   */
  private activeDrillingOperators = new Map<string, string>();

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
        `Error saving online operators to Redis: ${error.message}`,
      );
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
        `Error saving active drilling operators to Redis: ${error.message}`,
      );
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
      await this.saveOnlineOperatorsToRedis();

      this.logger.log(
        `🔗 Operator Connected: ${operatorId} (Online Operators: ${this.onlineOperators.size})`,
      );
      this.broadcastOnlineOperators(); // Notify all clients
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handles a WebSocket disconnection.
   * - Removes the operator from the online tracking list.
   * - Automatically stops any active drilling session.
   * - Emits an updated online operator count.
   *
   * @param client The disconnected WebSocket client.
   */
  async handleDisconnect(client: Socket) {
    try {
      const operatorId = client.data.operatorId;

      if (operatorId) {
        // Stop drilling if the operator was actively drilling
        if (this.activeDrillingOperators.has(operatorId)) {
          await this.stopDrilling(client);
        }

        this.onlineOperators.delete(operatorId);
        await this.saveOnlineOperatorsToRedis();

        this.logger.log(
          `❌ Operator Disconnected: ${operatorId} (Online Operators: ${this.onlineOperators.size})`,
        );
        this.broadcastOnlineOperators(); // Notify all clients
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
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
   * Gets the socket ID for a specific operator.
   *
   * @param operatorId The operator ID to look up
   * @returns The socket ID if found, undefined otherwise
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
    });
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
        });
        return;
      }

      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // Check if operator has enough fuel
      const hasEnoughFuel = await this.operatorService.hasEnoughFuel(objectId);
      if (!hasEnoughFuel) {
        client.emit('drilling-error', {
          message: 'Not enough fuel to start drilling',
        });
        return;
      }

      // Start drilling session
      const response =
        await this.drillingSessionService.startDrillingSession(objectId);

      if (response.status === 200) {
        // Track this operator as actively drilling
        this.activeDrillingOperators.set(operatorId, client.id);
        await this.saveActiveDrillingOperatorsToRedis();

        client.emit('drilling-started', {
          message: 'Drilling session started successfully',
          status: DrillingSessionStatus.WAITING,
        });

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `🔄 Operator ${operatorId} started drilling in waiting status`,
        );

        // Inform the client that the session will be activated on the next cycle
        client.emit('drilling-info', {
          message:
            'Your drilling session will be activated at the start of the next cycle',
        });
      } else {
        client.emit('drilling-error', {
          message: response.message,
        });
      }
    } catch (error) {
      this.logger.error(`Error starting drilling: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to start drilling: ${error.message}`,
      });
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
        });
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
        // Remove from active drilling operators
        this.activeDrillingOperators.delete(operatorId);
        await this.saveActiveDrillingOperatorsToRedis();

        client.emit('drilling-stopping', {
          message:
            'Drilling session stopping initiated. Will complete at end of cycle.',
          status: DrillingSessionStatus.STOPPING,
        });

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `🛑 Operator ${operatorId} initiated stopping drilling`,
        );
      } else {
        client.emit('drilling-error', {
          message: response.message,
        });
      }
    } catch (error) {
      this.logger.error(`Error stopping drilling: ${error.message}`);
      client.emit('drilling-error', {
        message: `Failed to stop drilling: ${error.message}`,
      });
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
      const socketId = this.activeDrillingOperators.get(operatorIdStr);

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

        // Remove from active drilling operators
        this.activeDrillingOperators.delete(operatorIdStr);
        await this.saveActiveDrillingOperatorsToRedis();

        // Notify the client if they're still connected
        if (socketId && this.server.sockets.sockets.has(socketId)) {
          this.server.to(socketId).emit('drilling-stopped', {
            message: 'Drilling stopped due to insufficient fuel',
            reason: 'fuel_depleted',
            status: DrillingSessionStatus.COMPLETED,
          });
        }

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(
          `⚠️ Operator ${operatorIdStr} stopped drilling due to fuel depletion`,
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
    payload: { message: string; reason: string },
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
        const socketId = this.activeDrillingOperators.get(operatorIdStr);

        try {
          // Force end the drilling session
          await this.drillingSessionService.forceEndDrillingSession(
            operatorId,
            cycleNumber,
          );

          // Remove from active drilling operators
          this.activeDrillingOperators.delete(operatorIdStr);

          // Notify the client if they're still connected
          if (socketId && this.server.sockets.sockets.has(socketId)) {
            this.server.to(socketId).emit('drilling-stopped', {
              ...payload,
              operatorId: operatorIdStr,
              status: DrillingSessionStatus.COMPLETED,
            });
          }

          this.logger.log(
            `⚠️ Operator ${operatorIdStr} stopped drilling due to fuel depletion`,
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
      const authHeader = client.handshake.headers.authorization;

      if (!authHeader) {
        this.logger.warn(`Client ${client.id} has no authorization header`);
        return null;
      }

      const token = authHeader.split(' ')[1];
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
}
