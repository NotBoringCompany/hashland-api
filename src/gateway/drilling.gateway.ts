import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { DrillingSessionService } from 'src/drills/drilling-session.service';
import { OperatorService } from 'src/operators/operator.service';
import { Types } from 'mongoose';
import { RedisService } from 'src/common/redis.service';

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
    @Inject(forwardRef(() => DrillingSessionService))
    private readonly drillingSessionService: DrillingSessionService,
    private readonly operatorService: OperatorService,
    private readonly redisService: RedisService,
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
   * - Adds the operator to the online tracking list.
   * - Emits an updated online operator count.
   *
   * @param client The connected WebSocket client.
   */
  async handleConnection(client: Socket) {
    const operatorId = client.handshake.query.operatorId as string;

    if (operatorId) {
      this.onlineOperators.add(operatorId);
      await this.saveOnlineOperatorsToRedis();

      this.logger.log(
        `🔗 Operator Connected: ${operatorId} (Online Operators: ${this.onlineOperators.size})`,
      );
      this.broadcastOnlineOperators(); // Notify all clients
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
    const operatorId = client.handshake.query.operatorId as string;

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
    const operatorId = client.handshake.query.operatorId as string;

    if (!operatorId) {
      client.emit('drilling-error', {
        message: 'No operator ID provided',
      });
      return;
    }

    try {
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
        });

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(`🔄 Operator ${operatorId} started drilling`);
      } else {
        client.emit('drilling-error', {
          message: response.message,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error starting drilling for ${operatorId}: ${error.message}`,
      );
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
    const operatorId = client.handshake.query.operatorId as string;

    if (!operatorId) {
      client.emit('drilling-error', {
        message: 'No operator ID provided',
      });
      return;
    }

    try {
      // Convert string ID to MongoDB ObjectId
      const objectId = new Types.ObjectId(operatorId);

      // End drilling session
      const response =
        await this.drillingSessionService.endDrillingSession(objectId);

      if (response.status === 200) {
        // Remove from active drilling operators
        this.activeDrillingOperators.delete(operatorId);
        await this.saveActiveDrillingOperatorsToRedis();

        client.emit('drilling-stopped', {
          message: 'Drilling session stopped successfully',
        });

        // Broadcast updated counts
        this.broadcastOnlineOperators();

        this.logger.log(`🛑 Operator ${operatorId} stopped drilling`);
      } else {
        client.emit('drilling-error', {
          message: response.message,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error stopping drilling for ${operatorId}: ${error.message}`,
      );
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
        // End the drilling session
        await this.drillingSessionService.endDrillingSession(operatorId);

        // Remove from active drilling operators
        this.activeDrillingOperators.delete(operatorIdStr);
        await this.saveActiveDrillingOperatorsToRedis();

        // Notify the client if they're still connected
        if (socketId && this.server.sockets.sockets.has(socketId)) {
          this.server.to(socketId).emit('drilling-stopped', {
            message: 'Drilling stopped due to insufficient fuel',
            reason: 'fuel_depleted',
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
}
