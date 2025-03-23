import { Injectable, Logger } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
import { RedisService } from 'src/common/redis.service';
import { DrillService } from 'src/drills/drill.service';
import { DrillingSessionStatus } from 'src/drills/drilling-session.service';
import { Types } from 'mongoose';
import { CycleRewardsResponse } from './drilling.gateway.types';

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
      const socketId =
        this.drillingGateway.getSocketIdForOperator(operatorIdStr);

      if (socketId) {
        this.drillingGateway.server.to(socketId).emit('drilling-activated', {
          message: `Your drilling session has been activated in cycle #${cycleNumber}`,
          status: DrillingSessionStatus.ACTIVE,
          cycleNumber,
        });

        this.logger.log(
          `🚀 Notified operator ${operatorIdStr} that their session was activated in cycle #${cycleNumber}`,
        );
      }
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
      const socketId =
        this.drillingGateway.getSocketIdForOperator(operatorIdStr);

      if (socketId) {
        this.drillingGateway.server.to(socketId).emit('drilling-completed', {
          message: `Your drilling session has been completed at the end of cycle #${cycleNumber}`,
          status: DrillingSessionStatus.COMPLETED,
          cycleNumber,
          earnedHASH: earnedHASH.get(operatorIdStr) || 0,
        });

        this.logger.log(
          `🏁 Notified operator ${operatorIdStr} that their session was completed in cycle #${cycleNumber}`,
        );
      }
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
      const socketId =
        this.drillingGateway.getSocketIdForOperator(operatorIdStr);

      if (socketId) {
        const message =
          changeType === 'depleted'
            ? `Your fuel has been depleted by ${changeAmount} units.`
            : `Your fuel has been replenished by ${changeAmount} units.`;

        this.drillingGateway.server.to(socketId).emit('fuel-update', {
          currentFuel: update.currentFuel,
          maxFuel: update.maxFuel,
          changeAmount,
          changeType,
          message,
        });

        this.logger.log(
          `⚡ Notified operator ${operatorIdStr} about fuel ${changeType}: ${changeAmount} units. Current: ${update.currentFuel}/${update.maxFuel}`,
        );
      }
    }
  }

  /**
   * Notifies all active operators about cycle rewards.
   *
   * @param cycleNumber The cycle number
   * @param extractorId The ID of the extractor (or null if no extractor)
   * @param extractorName The name of the extractor (or null if no extractor)
   * @param totalReward Total HASH reward for the cycle
   * @param rewardShares Array of operator IDs and their reward amounts
   * @param totalWeightedEff Total weighted efficiency of operators in this cycle
   */
  async notifyCycleRewards(
    cycleNumber: number,
    extractorId: Types.ObjectId | null,
    extractorName: string | null,
    totalReward: number,
    rewardShares: {
      operatorId: Types.ObjectId;
      operatorName: string;
      amount: number;
    }[],
    totalWeightedEff: number = 0,
  ) {
    // Convert the data to the format expected by the frontend
    const timestamp = new Date().toISOString();
    const payload: CycleRewardsResponse = {
      cycleNumber,
      timestamp,
      extractor: {
        id: extractorId ? extractorId.toString() : null,
        name: extractorName,
      },
      totalReward,
      totalWeightedEff,
      shares: rewardShares.map((share) => ({
        operatorId: share.operatorId.toString(),
        operatorName: share.operatorName,
        amount: share.amount,
      })),
    };

    // Broadcast to all connected clients
    this.drillingGateway.server.emit('cycle-rewards', payload);

    this.logger.log(
      `💰 Broadcasted cycle rewards for cycle #${cycleNumber} with ${rewardShares.length} operators and total weighted efficiency of ${totalWeightedEff}`,
    );
  }
}
