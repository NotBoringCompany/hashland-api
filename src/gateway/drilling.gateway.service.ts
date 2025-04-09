import { Injectable, Logger } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
import { RedisService } from 'src/common/redis.service';
import { DrillService } from 'src/drills/drill.service';
import { DrillingSessionStatus } from 'src/drills/drilling-session.service';
import { Types } from 'mongoose';
import { DrillingCycle } from 'src/drills/schemas/drilling-cycle.schema';

/**
 * Service for handling WebSocket interactions with the drilling gateway.
 */
@Injectable()
export class DrillingGatewayService {
  private readonly logger = new Logger(DrillingGatewayService.name);

  constructor(
    private readonly drillingGateway: DrillingGateway,
    private readonly redisService: RedisService,
    private readonly drillService: DrillService,
  ) {}

  /**
   * Sends real-time updates to all connected WebSocket clients.
   */
  async sendRealTimeUpdates() {
    // Directly fetch from Redis to prevent circular dependency with DrillingCycleService.
    const currentCycleNumberStr = await this.redisService.get(
      'drilling-cycle:current',
    );
    const currentCycleNumber = currentCycleNumberStr
      ? parseInt(currentCycleNumberStr, 10)
      : 0;

    const onlineOperators = this.drillingGateway.getOnlineOperatorCount();

    // Fetch issued HASH from Redis
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${currentCycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseInt(issuedHASHStr, 10) : 0;

    // Fetch total EFF and drilling difficulty
    const operatorEffData =
      await this.drillService.batchCalculateTotalEffAndDrillingDifficulty();

    this.drillingGateway.server.emit('drilling-update', {
      currentCycleNumber,
      onlineOperatorCount: onlineOperators,
      issuedHASH,
      operatorEffData,
    });

    this.logger.log(`📡 Sent real-time drilling updates.`);
  }

  /**
   * Notifies clients when their drilling sessions are activated at the start of a new cycle.
   *
   * @param operatorIds Array of operator IDs whose sessions were activated
   * @param cycleNumber The cycle number when sessions were activated
   */
  async notifySessionsActivated(
    operatorIds: Types.ObjectId[],
    cycleNumber: number,
  ) {
    for (const operatorId of operatorIds) {
      const operatorIdStr = operatorId.toString();
      const socketIds =
        this.drillingGateway.getAllSocketsForOperator(operatorIdStr);

      const activationMessage = {
        message: `Your drilling session has been activated in cycle #${cycleNumber}`,
        status: DrillingSessionStatus.ACTIVE,
        cycleNumber,
      };

      for (const socketId of socketIds) {
        if (this.drillingGateway.server.sockets.sockets.has(socketId)) {
          this.drillingGateway.server
            .to(socketId)
            .emit('drilling-activated', activationMessage);
        }
      }

      this.logger.log(
        `🚀 Notified operator ${operatorIdStr} on ${socketIds.length} device(s) that their session was activated in cycle #${cycleNumber}`,
      );
    }
  }

  /**
   * Notifies clients when their drilling sessions are completed at the end of a cycle.
   *
   * @param operatorIds Array of operator IDs whose sessions were completed
   * @param cycleNumber The cycle number when sessions were completed
   * @param earnedHASH Map of operator IDs to earned HASH amounts
   */
  async notifySessionsCompleted(
    operatorIds: Types.ObjectId[],
    cycleNumber: number,
    earnedHASH: Map<string, number>,
  ) {
    for (const operatorId of operatorIds) {
      const operatorIdStr = operatorId.toString();
      const socketIds =
        this.drillingGateway.getAllSocketsForOperator(operatorIdStr);

      const completionMessage = {
        message: `Your drilling session has been completed at the end of cycle #${cycleNumber}`,
        status: DrillingSessionStatus.COMPLETED,
        cycleNumber,
        earnedHASH: earnedHASH.get(operatorIdStr) || 0,
      };

      for (const socketId of socketIds) {
        if (this.drillingGateway.server.sockets.sockets.has(socketId)) {
          this.drillingGateway.server
            .to(socketId)
            .emit('drilling-completed', completionMessage);
        }
      }

      this.logger.log(
        `🏁 Notified operator ${operatorIdStr} on ${socketIds.length} device(s) that their session was completed in cycle #${cycleNumber}`,
      );
    }
  }

  /**
   * Notifies operators about fuel updates (depletion or replenishment).
   *
   * @param operatorUpdates Array of operator updates with fuel information
   * @param changeAmount Amount of fuel changed
   * @param changeType Type of change ('depleted' or 'replenished')
   */
  async notifyFuelUpdates(
    operatorUpdates: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[],
    changeAmount: number,
    changeType: 'depleted' | 'replenished',
  ) {
    for (const update of operatorUpdates) {
      const operatorIdStr = update.operatorId.toString();
      const socketIds =
        this.drillingGateway.getAllSocketsForOperator(operatorIdStr);

      const message =
        changeType === 'depleted'
          ? `Your fuel has been depleted by ${changeAmount} units.`
          : `Your fuel has been replenished by ${changeAmount} units.`;

      const fuelUpdateMessage = {
        currentFuel: update.currentFuel,
        maxFuel: update.maxFuel,
        changeAmount,
        changeType,
        message,
      };

      for (const socketId of socketIds) {
        if (this.drillingGateway.server.sockets.sockets.has(socketId)) {
          this.drillingGateway.server
            .to(socketId)
            .emit('fuel-update', fuelUpdateMessage);
        }
      }

      this.logger.log(
        `⚡ Notified operator ${operatorIdStr} on ${socketIds.length} device(s) about fuel ${changeType}: ${changeAmount} units. Current: ${update.currentFuel}/${update.maxFuel}`,
      );
    }
  }

  /**
   * Notifies all active operators about the latest drilling cycle.
   *
   * @param drillingCycle The latest drilling cycle data
   * @param rewardShares Optional array of reward shares for each operator
   */
  async notifyNewCycle(
    drillingCycle: DrillingCycle | null,
    rewardShares?: Array<{ operatorId: Types.ObjectId; amount: number }>,
  ) {
    // Ensure we have a valid cycle before broadcasting
    if (!drillingCycle || !drillingCycle.cycleNumber) {
      this.logger.warn(
        '⚠️ Attempted to notify about null or invalid drilling cycle, skipping notification',
      );
      return;
    }

    // First, broadcast the base cycle data to everyone
    this.drillingGateway.server.emit('new-cycle', drillingCycle);

    this.logger.debug('(notifyNewCycle) rewardShares', rewardShares);

    // Process reward shares if available
    if (rewardShares && rewardShares.length > 0) {
      const operatorRewards = new Map<string, number>();

      // Create a map of operator IDs to reward amounts
      for (const share of rewardShares) {
        if (share.operatorId) {
          operatorRewards.set(share.operatorId.toString(), share.amount);
        }
      }

      this.logger.debug('(notifyNewCycle) operatorRewards', operatorRewards);

      // Get connected operator IDs
      const socketOperators = this.drillingGateway.getConnectedOperatorIds();
      let processedCount = 0;

      // Send reward info to each operator
      for (const operatorId of socketOperators) {
        const operatorReward = operatorRewards.get(operatorId) || 0;

        // Only send if operator actually has a reward
        if (operatorReward > 0) {
          const socketIds =
            this.drillingGateway.getAllSocketsForOperator(operatorId);

          // Create a minimal payload with just the reward info
          const rewardData = {
            cycleNumber: drillingCycle.cycleNumber,
            operatorReward,
          };

          // Send to all operator's devices
          for (const socketId of socketIds) {
            if (this.drillingGateway.server.sockets.sockets.has(socketId)) {
              this.drillingGateway.server
                .to(socketId)
                .emit('cycle-reward', rewardData);
            }
          }
          processedCount++;
        }
      }

      if (processedCount > 0) {
        this.logger.log(
          `💸 Sent personalized rewards to ${processedCount} operators for cycle #${drillingCycle.cycleNumber}`,
        );
      }
    }

    this.logger.log(
      `💰 Broadcasted new cycle #${drillingCycle.cycleNumber} with ${drillingCycle.activeOperators} active operators and total weighted efficiency of ${drillingCycle.totalWeightedEff || 0}`,
    );
  }
}
