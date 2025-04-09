import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DrillingSession } from './schemas/drilling-session.schema';
import { Model, Types } from 'mongoose';
import { RedisService } from 'src/common/redis.service';
import { ApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from 'src/operators/operator.service';
import { RedisDrillingSession } from 'src/gateway/drilling.gateway.types';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';

// Define session status enum
export enum DrillingSessionStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
}

@Injectable()
export class DrillingSessionService {
  private readonly logger = new Logger(DrillingSessionService.name);
  private readonly redisActiveSessionsKey = 'drilling:activeSessionsCount';
  private readonly redisWaitingSessionsKey = 'drilling:waitingSessionsCount';
  private readonly redisStoppingSessionsKey = 'drilling:stoppingSessionsCount';
  private readonly redisSessionKeyPrefix = 'drilling:session:';

  constructor(
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
    private readonly redisService: RedisService,
    private readonly operatorService: OperatorService,
    private readonly operatorWalletService: OperatorWalletService,
  ) {}

  /**
   * Generates a Redis key for a specific drilling session.
   * @param operatorId The operator ID
   */
  private getSessionKey(operatorId: Types.ObjectId | string): string {
    return `${this.redisSessionKeyPrefix}${operatorId.toString()}`;
  }

  /**
   * Creates a new drilling session in Redis.
   *
   * Called whenever an operator starts drilling for $HASH.
   * The session starts in WAITING status until the next drilling cycle begins.
   */
  async startDrillingSession(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      const operatorIdStr = operatorId.toString();
      const sessionKey = this.getSessionKey(operatorIdStr);

      // ✅ Ensure latest asset equity is fetched **before starting**
      await this.operatorWalletService
        .updateAssetEquityForOperator(operatorId)
        .catch((err) => {
          this.logger.error(
            `❌ (startDrillingSession) Error updating asset equity for operator ${operatorId}: ${err.message}`,
          );

          return new ApiResponse<null>(
            500,
            `(startDrillingSession) Error updating asset equity for operator ${operatorId}: ${err.message}. Please try again.`,
          );
        });

      // Check if operator already has an active session in Redis
      const existingSession = await this.redisService.get(sessionKey);
      if (existingSession) {
        const session = JSON.parse(existingSession) as RedisDrillingSession;
        if (!session.endTime) {
          return new ApiResponse<null>(
            400,
            `(startDrillingSession) Operator already has an active drilling session.`,
          );
        }
      }

      // Check if the operator's current fuel is enough.
      if (!(await this.operatorService.hasEnoughFuel(operatorId))) {
        return new ApiResponse<null>(
          400,
          `(startDrillingSession) Operator does not have enough fuel to start a drilling session.`,
        );
      }

      // Create a new drilling session in Redis
      const newSession: RedisDrillingSession = {
        operatorId: operatorIdStr,
        startTime: new Date().toISOString(),
        endTime: null,
        earnedHASH: 0,
        status: DrillingSessionStatus.WAITING, // Start in waiting status
        cycleStarted: null,
        cycleEnded: null,
      };

      // Store in Redis
      await this.redisService.set(sessionKey, JSON.stringify(newSession));

      // Increment waiting session count in Redis
      await this.redisService.increment(this.redisWaitingSessionsKey, 1);

      this.logger.log(
        `✅ (startDrillingSession) Operator ${operatorId} started drilling in WAITING status.`,
      );

      // Also store in MongoDB for historical records (initial creation)
      await this.drillingSessionModel.create({
        operatorId,
        startTime: new Date(),
        earnedHASH: 0,
      });

      return new ApiResponse<null>(
        200,
        `(startDrillingSession) Drilling session started in waiting status.`,
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(startDrillingSession) Error starting drilling session: ${err.message}`,
      );
    }
  }

  /**
   * Activates all waiting drilling sessions when a new cycle begins.
   * Called by the DrillingCycleService when a new cycle is created.
   *
   * @param cycleNumber The new cycle number
   * @returns Object containing the number of sessions activated and the operator IDs
   */
  async activateWaitingSessionsForNewCycle(
    cycleNumber: number,
  ): Promise<{ count: number; operatorIds: Types.ObjectId[] }> {
    try {
      // Find all waiting sessions
      const sessionKeys = await this.redisService.scanKeys(
        `${this.redisSessionKeyPrefix}*`,
      );

      if (!sessionKeys.length) return { count: 0, operatorIds: [] };

      // Get all sessions in batch
      const sessionsData = await this.redisService.mget(sessionKeys);

      // Filter waiting sessions
      const waitingSessions: {
        key: string;
        session: RedisDrillingSession;
        operatorId: Types.ObjectId;
      }[] = [];

      for (let i = 0; i < sessionsData.length; i++) {
        const sessionData = sessionsData[i];
        if (!sessionData) continue;

        const session = JSON.parse(sessionData) as RedisDrillingSession;
        if (
          session.status === DrillingSessionStatus.WAITING &&
          !session.endTime
        ) {
          const operatorId = new Types.ObjectId(session.operatorId);
          waitingSessions.push({
            key: sessionKeys[i],
            session,
            operatorId,
          });
        }
      }

      if (!waitingSessions.length) {
        this.logger.log(
          `(activateWaitingSessionsForNewCycle) No waiting sessions to activate for cycle #${cycleNumber}`,
        );
        return { count: 0, operatorIds: [] };
      }

      // Update all waiting sessions to active
      const updatePromises = waitingSessions.map(({ key, session }) => {
        session.status = DrillingSessionStatus.ACTIVE;
        session.cycleStarted = cycleNumber;
        return this.redisService.set(key, JSON.stringify(session));
      });

      await Promise.all(updatePromises);

      // Update counters
      await this.redisService.increment(
        this.redisWaitingSessionsKey,
        -waitingSessions.length,
      );
      await this.redisService.increment(
        this.redisActiveSessionsKey,
        waitingSessions.length,
      );

      // Extract operator IDs for notifications
      const operatorIds = waitingSessions.map(({ operatorId }) => operatorId);

      this.logger.log(
        `🚀 (activateWaitingSessionsForNewCycle) Activated ${waitingSessions.length} waiting sessions for cycle #${cycleNumber}`,
      );

      return { count: waitingSessions.length, operatorIds };
    } catch (err: any) {
      this.logger.error(
        `❌ (activateWaitingSessionsForNewCycle) Error: ${err.message}`,
      );
      return { count: 0, operatorIds: [] };
    }
  }

  /**
   * Completes all stopping sessions at the end of a cycle.
   * Called by the DrillingCycleService when a cycle ends.
   *
   * @param cycleNumber The ending cycle number
   * @returns Object containing the number of sessions completed, operator IDs, and earned HASH
   */
  async completeStoppingSessionsForEndCycle(cycleNumber: number): Promise<{
    count: number;
    operatorIds: Types.ObjectId[];
    earnedHASH: Map<string, number>;
  }> {
    try {
      // Find all stopping sessions
      const sessionKeys = await this.redisService.scanKeys(
        `${this.redisSessionKeyPrefix}*`,
      );

      if (!sessionKeys.length) {
        return {
          count: 0,
          operatorIds: [],
          earnedHASH: new Map<string, number>(),
        };
      }

      // Get all sessions in batch
      const sessionsData = await this.redisService.mget(sessionKeys);

      // Filter stopping sessions
      const stoppingSessions: {
        key: string;
        session: RedisDrillingSession;
        operatorId: Types.ObjectId;
      }[] = [];

      for (let i = 0; i < sessionsData.length; i++) {
        const sessionData = sessionsData[i];
        if (!sessionData) continue;

        const session = JSON.parse(sessionData) as RedisDrillingSession;
        if (
          session.status === DrillingSessionStatus.STOPPING &&
          !session.endTime
        ) {
          stoppingSessions.push({
            key: sessionKeys[i],
            session,
            operatorId: new Types.ObjectId(session.operatorId),
          });
        }
      }

      if (!stoppingSessions.length) {
        this.logger.log(
          `(completeStoppingSessionsForEndCycle) No stopping sessions to complete for cycle #${cycleNumber}`,
        );
        return {
          count: 0,
          operatorIds: [],
          earnedHASH: new Map<string, number>(),
        };
      }

      // Update MongoDB for historical records in bulk
      const bulkOps = stoppingSessions.map(({ operatorId, session }) => ({
        updateOne: {
          filter: { operatorId, endTime: null },
          update: {
            endTime: new Date(),
            earnedHASH: session.earnedHASH,
          },
        },
      }));

      await this.drillingSessionModel.bulkWrite(bulkOps);

      // Create a map of operator IDs to earned HASH for notifications
      const earnedHASHMap = new Map<string, number>();
      stoppingSessions.forEach(({ operatorId, session }) => {
        earnedHASHMap.set(operatorId.toString(), session.earnedHASH);
      });

      // Delete sessions from Redis
      const deletePromises = stoppingSessions.map(({ key }) =>
        this.redisService.del(key),
      );

      await Promise.all(deletePromises);

      // Update counter
      await this.redisService.increment(
        this.redisStoppingSessionsKey,
        -stoppingSessions.length,
      );

      // Extract operator IDs for notifications
      const operatorIds = stoppingSessions.map(({ operatorId }) => operatorId);

      this.logger.log(
        `🏁 (completeStoppingSessionsForEndCycle) Completed ${stoppingSessions.length} stopping sessions for cycle #${cycleNumber}`,
      );

      return {
        count: stoppingSessions.length,
        operatorIds,
        earnedHASH: earnedHASHMap,
      };
    } catch (err: any) {
      this.logger.error(
        `❌ (completeStoppingSessionsForEndCycle) Error: ${err.message}`,
      );
      return {
        count: 0,
        operatorIds: [],
        earnedHASH: new Map<string, number>(),
      };
    }
  }

  /**
   * Initiates stopping a drilling session.
   * The session enters STOPPING status until the current cycle ends.
   */
  async initiateStopDrillingSession(
    operatorId: Types.ObjectId,
    cycleNumber: number,
  ): Promise<ApiResponse<null>> {
    try {
      const operatorIdStr = operatorId.toString();
      const sessionKey = this.getSessionKey(operatorIdStr);

      // Get current session from Redis
      const sessionData = await this.redisService.get(sessionKey);
      if (!sessionData) {
        return new ApiResponse<null>(
          404,
          `(initiateStopDrillingSession) No active session found for this operator.`,
        );
      }

      const session = JSON.parse(sessionData) as RedisDrillingSession;
      if (session.endTime) {
        return new ApiResponse<null>(
          400,
          `(initiateStopDrillingSession) Session is already ended.`,
        );
      }

      // Store previous status before updating
      const previousStatus = session.status;

      // Update session to stopping status
      session.status = DrillingSessionStatus.STOPPING;
      session.cycleEnded = cycleNumber;
      await this.redisService.set(sessionKey, JSON.stringify(session));

      // Update counters
      if (previousStatus === DrillingSessionStatus.ACTIVE) {
        await this.redisService.increment(this.redisActiveSessionsKey, -1);
        await this.redisService.increment(this.redisStoppingSessionsKey, 1);
      } else if (previousStatus === DrillingSessionStatus.WAITING) {
        await this.redisService.increment(this.redisWaitingSessionsKey, -1);
        await this.redisService.increment(this.redisStoppingSessionsKey, 1);
      }

      this.logger.log(
        `🛑 (initiateStopDrillingSession) Operator ${operatorId} initiated stopping drilling in cycle #${cycleNumber}.`,
      );

      return new ApiResponse<null>(
        200,
        `(initiateStopDrillingSession) Drilling session stopping initiated. Will complete at end of cycle.`,
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(initiateStopDrillingSession) Error stopping drilling session: ${err.message}`,
      );
    }
  }

  /**
   * Immediately ends a drilling session (for emergency stops or fuel depletion).
   * This bypasses the normal stopping process and immediately completes the session.
   */
  async forceEndDrillingSession(
    operatorId: Types.ObjectId,
    cycleNumber: number,
  ): Promise<ApiResponse<null>> {
    try {
      const operatorIdStr = operatorId.toString();
      const sessionKey = this.getSessionKey(operatorIdStr);

      // Get current session from Redis
      const sessionData = await this.redisService.get(sessionKey);
      if (!sessionData) {
        return new ApiResponse<null>(
          404,
          `(forceEndDrillingSession) No active session found for this operator.`,
        );
      }

      const session = JSON.parse(sessionData) as RedisDrillingSession;
      if (session.endTime) {
        return new ApiResponse<null>(
          400,
          `(forceEndDrillingSession) Session is already ended.`,
        );
      }

      // Store previous status before updating
      const previousStatus = session.status;
      const now = new Date();

      // Update MongoDB for historical record
      await this.drillingSessionModel.findOneAndUpdate(
        { operatorId, endTime: null },
        {
          endTime: now,
          earnedHASH: session.earnedHASH,
        },
      );

      // Updates the operator's total HASH earned
      await this.operatorService.incrementTotalHASHEarned(
        operatorId,
        session.earnedHASH,
      );

      // Delete from Redis
      await this.redisService.del(sessionKey);

      // Update counters
      if (previousStatus === DrillingSessionStatus.ACTIVE) {
        await this.redisService.increment(this.redisActiveSessionsKey, -1);
      } else if (previousStatus === DrillingSessionStatus.WAITING) {
        await this.redisService.increment(this.redisWaitingSessionsKey, -1);
      } else if (previousStatus === DrillingSessionStatus.STOPPING) {
        await this.redisService.increment(this.redisStoppingSessionsKey, -1);
      }

      this.logger.log(
        `🛑 (forceEndDrillingSession) Operator ${operatorId} force stopped drilling in cycle #${cycleNumber}.`,
      );

      return new ApiResponse<null>(
        200,
        `(forceEndDrillingSession) Drilling session force stopped.`,
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(forceEndDrillingSession) Error force stopping drilling session: ${err.message}`,
      );
    }
  }

  /**
   * Updates the earned HASH for an active drilling session.
   */
  async updateSessionEarnedHash(
    operatorId: Types.ObjectId,
    earnedHASH: number,
  ): Promise<boolean> {
    try {
      const operatorIdStr = operatorId.toString();
      const sessionKey = this.getSessionKey(operatorIdStr);

      // Get current session from Redis
      const sessionData = await this.redisService.get(sessionKey);
      if (!sessionData) {
        return false;
      }

      const session = JSON.parse(sessionData) as RedisDrillingSession;
      if (session.endTime) {
        return false;
      }

      // Only update HASH for active sessions
      if (session.status !== DrillingSessionStatus.ACTIVE) {
        return false;
      }

      // Update earned HASH
      session.earnedHASH += earnedHASH;
      await this.redisService.set(sessionKey, JSON.stringify(session));
      return true;
    } catch (err) {
      this.logger.error(
        `Error updating earned HASH for ${operatorId}: ${err.message}`,
      );
      return false;
    }
  }

  /**
   * Fetches the total number of active drilling sessions from Redis.
   */
  async fetchActiveDrillingSessionsCount(): Promise<number> {
    const activeSessions = await this.redisService.get(
      this.redisActiveSessionsKey,
    );
    // Ensure we never return a negative value, as that would be invalid
    const count = activeSessions ? parseInt(activeSessions, 10) : 0;
    return Math.max(0, count);
  }

  /**
   * Fetches the total number of waiting drilling sessions from Redis.
   */
  async fetchWaitingDrillingSessionsCount(): Promise<number> {
    const waitingSessions = await this.redisService.get(
      this.redisWaitingSessionsKey,
    );
    // Ensure we never return a negative value, as that would be invalid
    const count = waitingSessions ? parseInt(waitingSessions, 10) : 0;
    return Math.max(0, count);
  }

  /**
   * Fetches the total number of stopping drilling sessions from Redis.
   */
  async fetchStoppingDrillingSessionsCount(): Promise<number> {
    const stoppingSessions = await this.redisService.get(
      this.redisStoppingSessionsKey,
    );
    // Ensure we never return a negative value, as that would be invalid
    const count = stoppingSessions ? parseInt(stoppingSessions, 10) : 0;
    return Math.max(0, count);
  }

  /**
   * Fetches the total number of active drilling sessions (both waiting and active).
   */
  async fetchActiveDrillingSessionsRedis(): Promise<number> {
    const [active, waiting] = await Promise.all([
      this.fetchActiveDrillingSessionsCount(),
      this.fetchWaitingDrillingSessionsCount(),
    ]);
    return active + waiting;
  }

  /**
   * Fetches the operator IDs from all active drilling sessions.
   */
  async fetchActiveDrillingSessionOperatorIds(): Promise<Types.ObjectId[]> {
    // Use Redis scan to find all active sessions
    const sessionKeys = await this.redisService.scanKeys(
      `${this.redisSessionKeyPrefix}*`,
    );

    if (!sessionKeys.length) return [];

    // Get all sessions in batch
    const sessionsData = await this.redisService.mget(sessionKeys);

    // Filter active sessions and extract operator IDs
    const operatorIds: Types.ObjectId[] = [];

    for (const sessionData of sessionsData) {
      if (!sessionData) continue;

      const session = JSON.parse(sessionData) as RedisDrillingSession;
      if (!session.endTime && session.status === DrillingSessionStatus.ACTIVE) {
        operatorIds.push(new Types.ObjectId(session.operatorId));
      }
    }

    return operatorIds;
  }

  /**
   * Fetches the IDs of operators who currently have an active `DrillingSession` instance.
   */
  async fetchActiveOperatorIds(): Promise<Set<Types.ObjectId>> {
    const operatorIds = await this.fetchActiveDrillingSessionOperatorIds();
    return new Set(operatorIds);
  }

  /**
   * Stops drilling sessions for operators who have depleted their fuel below threshold.
   * @param depletedOperatorIds Array of operator IDs whose fuel is depleted
   */
  async stopDrillingForDepletedOperators(
    depletedOperatorIds: Types.ObjectId[],
    currentCycleNumber: number,
  ): Promise<void> {
    if (depletedOperatorIds.length === 0) {
      this.logger.log(
        `🔋 No operators depleted below threshold. Skipping session termination.`,
      );
      return;
    }

    // Force end sessions in Redis for depleted operators
    for (const operatorId of depletedOperatorIds) {
      await this.forceEndDrillingSession(operatorId, currentCycleNumber);
    }

    this.logger.log(
      `🛑 Force stopped ${depletedOperatorIds.length} drilling sessions due to fuel depletion.`,
    );
  }

  /**
   * Gets the current drilling session for an operator.
   */
  async getOperatorSession(
    operatorId: Types.ObjectId,
  ): Promise<RedisDrillingSession | null> {
    try {
      const sessionKey = this.getSessionKey(operatorId);
      const sessionData = await this.redisService.get(sessionKey);

      if (!sessionData) return null;

      return JSON.parse(sessionData) as RedisDrillingSession;
    } catch (err) {
      this.logger.error(
        `Error getting session for ${operatorId}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Recalibrates session counters in Redis by counting the actual number of sessions
   * in each status. This helps fix counter drift that may occur due to race conditions.
   */
  async recalibrateSessionCounters(): Promise<void> {
    try {
      this.logger.log('🔄 Recalibrating Redis session counters...');

      // Get all session keys
      const sessionKeys = await this.redisService.scanKeys(
        `${this.redisSessionKeyPrefix}*`,
      );

      if (!sessionKeys.length) {
        // If no sessions, set all counters to 0
        await Promise.all([
          this.redisService.set(this.redisActiveSessionsKey, '0'),
          this.redisService.set(this.redisWaitingSessionsKey, '0'),
          this.redisService.set(this.redisStoppingSessionsKey, '0'),
        ]);
        this.logger.log('✅ Counters reset to 0 - no sessions found');
        return;
      }

      // Get all sessions in batch
      const sessionsData = await this.redisService.mget(sessionKeys);

      // Count sessions by status
      let activeCount = 0;
      let waitingCount = 0;
      let stoppingCount = 0;

      for (const sessionData of sessionsData) {
        if (!sessionData) continue;

        const session = JSON.parse(sessionData) as RedisDrillingSession;

        if (session.endTime) continue; // Skip ended sessions

        switch (session.status) {
          case DrillingSessionStatus.ACTIVE:
            activeCount++;
            break;
          case DrillingSessionStatus.WAITING:
            waitingCount++;
            break;
          case DrillingSessionStatus.STOPPING:
            stoppingCount++;
            break;
        }
      }

      // Update all counters to match actual counts
      await Promise.all([
        this.redisService.set(
          this.redisActiveSessionsKey,
          activeCount.toString(),
        ),
        this.redisService.set(
          this.redisWaitingSessionsKey,
          waitingCount.toString(),
        ),
        this.redisService.set(
          this.redisStoppingSessionsKey,
          stoppingCount.toString(),
        ),
      ]);

      this.logger.log(
        `✅ Counters recalibrated: active=${activeCount}, waiting=${waitingCount}, stopping=${stoppingCount}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error recalibrating session counters: ${error.message}`,
      );
      // Don't rethrow to avoid breaking calling methods
    }
  }
}
