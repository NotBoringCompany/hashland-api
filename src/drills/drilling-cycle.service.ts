import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DrillingCycle } from './schemas/drilling-cycle.schema';
import { RedisService } from 'src/common/redis.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { ApiResponse } from 'src/common/dto/response.dto';
import { performance } from 'perf_hooks'; // Import high-precision timer
import { DrillingSessionService } from './drilling-session.service';
import { Drill } from './schemas/drill.schema';
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';
import { Pool } from 'src/pools/schemas/pool.schema';
import { OperatorService } from 'src/operators/operator.service';
import { DrillService } from './drill.service';
import { DrillingGatewayService } from 'src/gateway/drilling.gateway.service';
import { DrillingSession } from './schemas/drilling-session.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { DrillingGateway } from 'src/gateway/drilling.gateway';
@Injectable()
export class DrillingCycleService {
  private readonly logger = new Logger(DrillingCycleService.name);
  private readonly redisCycleKey = 'drilling-cycle:current';
  private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000; // Convert to ms

  constructor(
    @InjectModel(DrillingCycle.name)
    private drillingCycleModel: Model<DrillingCycle>,
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    @InjectModel(Pool.name) private poolModel: Model<Pool>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    private readonly redisService: RedisService,
    private readonly drillingSessionService: DrillingSessionService,
    private readonly drillService: DrillService,
    private readonly operatorService: OperatorService,
    private readonly drillingGatewayService: DrillingGatewayService,
    private readonly drillingGateway: DrillingGateway,
  ) {}

  /**
   * Initializes the cycle number in Redis if not already set.
   */
  async initializeCycleNumber() {
    const cycleNumber = await this.redisService.get(this.redisCycleKey);

    if (!cycleNumber) {
      const latestCycle = await this.drillingCycleModel
        .findOne()
        .sort({ cycleNumber: -1 })
        .exec();
      const newCycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;

      await this.redisService.set(
        this.redisCycleKey,
        newCycleNumber.toString(),
      );
      this.logger.log(`🔄 Redis Cycle Number Initialized: ${newCycleNumber}`);
    }
  }

  /**
   * Creates a new drilling cycle every `CYCLE_DURATION` seconds.
   */
  async createDrillingCycle(): Promise<number> {
    const newCycleNumber = await this.redisService.increment(
      this.redisCycleKey,
      1,
    );
    const now = new Date();
    const startFetchTime = performance.now();

    this.logger.log(`🛠 Creating Drilling Cycle: #${newCycleNumber}...`);

    // Fetch HASH issuance from game constants
    const issuedHash = GAME_CONSTANTS.HASH_ISSUANCE.CYCLE_HASH_ISSUANCE;

    // Store in Redis for fast access
    await this.redisService.set(
      `drilling-cycle:${newCycleNumber}:issuedHASH`,
      issuedHash.toString(),
    );

    try {
      // Activate all waiting sessions for this new cycle
      const activationResult =
        await this.drillingSessionService.activateWaitingSessionsForNewCycle(
          newCycleNumber,
        );

      this.logger.log(
        `✅ Activated ${activationResult.count} waiting drilling sessions for cycle #${newCycleNumber}`,
      );

      // Notify operators that their sessions were activated
      if (activationResult.operatorIds.length > 0) {
        this.drillingGatewayService.notifySessionsActivated(
          activationResult.operatorIds,
          newCycleNumber,
        );
      }

      // Get total active operators after activation
      const activeOperators =
        await this.drillingSessionService.fetchActiveDrillingSessionsCount();

      // Create the drilling cycle with active operator count
      await this.drillingCycleModel.create({
        cycleNumber: newCycleNumber,
        startTime: now,
        endTime: new Date(now.getTime() + this.cycleDuration),
        activeOperators, // Track active operators
        extractorId: null,
        difficulty: 0,
        issuedHASH: GAME_CONSTANTS.HASH_ISSUANCE.CYCLE_HASH_ISSUANCE,
      });

      const endFetchTime = performance.now();

      this.logger.log(
        `⏳ (Performance) Drilling Cycle #${newCycleNumber} setup with ${activeOperators} operators took ${endFetchTime - startFetchTime}ms.`,
      );

      // ✅ Step 2: Trigger WebSocket real-time updates (handles active operators, difficulty, etc.)
      this.drillingGatewayService.sendRealTimeUpdates();

      return newCycleNumber;
    } catch (error) {
      this.logger.error(`❌ Error Creating Drilling Cycle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ends the current drilling cycle. Called at the end of each cycle.
   *
   * This method is responsible for:
   * 1. Selecting the extractor for this cycle.
   * 2. Distributing rewards to operators.
   * 3. Depleting or replenishing fuel for operators.
   * 4. Updating the cycle with the selected extractor.
   * 5. Completing any stopping sessions.
   */
  async endCurrentCycle(cycleNumber: number) {
    const startTime = performance.now();
    this.logger.log(`⏳ (endCurrentCycle) Ending cycle #${cycleNumber}...`);

    // Fetch issued HASH from Redis
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${cycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseFloat(issuedHASHStr) : 0; // Ensure it's a number

    // ✅ Step 1: Select extractor
    const extractorData = await this.drillService.selectExtractor();
    if (!extractorData) {
      this.logger.warn(
        `(endCurrentCycle) No valid extractor drill found. Skipping reward distribution.`,
      );
    } else {
      // ✅ Step 2: Distribute rewards
      await this.distributeCycleRewards(extractorData.drillId, issuedHASH);
    }

    // ✅ Step 3: Process Fuel for ALL Operators
    await this.processFuelForAllOperators(cycleNumber);

    // ✅ Step 4: Update the cycle with extractor ID
    if (extractorData) {
      await this.drillingCycleModel.updateOne(
        { cycleNumber },
        { extractorId: extractorData.drillId },
      );
    }

    // ✅ Step 5: Complete any stopping sessions
    const completionResult =
      await this.drillingSessionService.completeStoppingSessionsForEndCycle(
        cycleNumber,
      );

    this.logger.log(
      `✅ Completed ${completionResult.count} stopping drilling sessions at end of cycle #${cycleNumber}`,
    );

    // Notify operators that their sessions were completed
    if (completionResult.operatorIds.length > 0) {
      this.drillingGatewayService.notifySessionsCompleted(
        completionResult.operatorIds,
        cycleNumber,
        completionResult.earnedHASH,
      );
    }

    const endTime = performance.now();
    this.logger.log(
      `✅ (endCurrentCycle) Cycle #${cycleNumber} processing completed in ${(endTime - startTime).toFixed(2)}ms.`,
    );
  }

  /**
   * Distributes $HASH rewards to operators at the end of a drilling cycle.
   */
  async distributeCycleRewards(
    extractorId: Types.ObjectId,
    issuedHash: number,
  ) {
    const now = performance.now();

    // ✅ Step 1: Fetch Extractor's Operator ID
    const extractorDrill = await this.drillModel
      .findById(extractorId)
      .select('operatorId')
      .lean();
    if (!extractorDrill) {
      this.logger.error(
        `(distributeCycleRewards) Extractor drill not found: ${extractorId}`,
      );
      return;
    }
    const extractorOperatorId = extractorDrill.operatorId;

    // ✅ Step 2: Fetch All Active Operators' IDs
    const allActiveOperatorIds =
      await this.drillingSessionService.fetchActiveDrillingSessionOperatorIds();
    if (allActiveOperatorIds.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No active operators found for reward distribution.`,
      );
      return;
    }

    // ✅ Step 3: Check If Extractor is in a Pool
    const poolOperator = await this.poolOperatorModel
      .findOne({ operatorId: extractorOperatorId })
      .select('poolId')
      .lean();
    const isSoloOperator = !poolOperator;

    // ✅ Step 4: Fetch Active Operators' Data (Cumulative Eff, Eff Multiplier)
    const activeOperators = await this.operatorModel
      .find(
        { _id: { $in: allActiveOperatorIds } },
        { _id: 1, cumulativeEff: 1, effMultiplier: 1 },
      )
      .lean();

    if (activeOperators.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No valid active operators.`,
      );
      return;
    }

    // ✅ Step 5: Apply Luck Factor & Compute Weighted Eff
    const operatorsWithLuck = activeOperators.map((operator) => {
      const luckFactor =
        GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER +
        Math.random() *
          (GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER -
            GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER);

      return {
        operatorId: operator._id,
        weightedEff:
          operator.cumulativeEff * operator.effMultiplier * luckFactor,
      };
    });

    // ✅ Step 6: Compute Total Weighted Eff Sum
    const totalWeightedEff = operatorsWithLuck.reduce(
      (sum, op) => sum + op.weightedEff,
      0,
    );
    if (totalWeightedEff === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No valid weighted EFF for reward distribution.`,
      );
      return;
    }

    // ✅ Step 7: Compute Extractor and Active Operators' Rewards
    const rewardData: { operatorId: Types.ObjectId; amount: number }[] = [];

    if (isSoloOperator) {
      // 🟢 SOLO OPERATOR REWARD LOGIC
      const extractorReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;
      const activeOperatorsReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

      // ✅ Step 8A: Compute Each Operator's Reward Share Based on Weighted Eff
      const weightedRewards = operatorsWithLuck.map((operator) => ({
        operatorId: operator.operatorId,
        amount:
          (operator.weightedEff / totalWeightedEff) * activeOperatorsReward,
      }));

      // ✅ Step 8B: Store Rewards for Batch Update
      rewardData.push(
        { operatorId: extractorOperatorId, amount: extractorReward }, // Extractor Reward
        ...weightedRewards, // Active Operators' Rewards
      );

      this.logger.log(
        `✅ (distributeCycleRewards) SOLO rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH.`,
      );
    } else {
      // 🟢 POOL OPERATOR REWARD LOGIC
      const pool = await this.poolModel
        .findById(poolOperator.poolId)
        .select('leaderId rewardSystem')
        .lean();
      if (!pool) {
        this.logger.error(
          `(distributeCycleRewards) Pool not found for extractor operator: ${extractorOperatorId}`,
        );
        return;
      }

      // ✅ Step 8A: Get Active Pool Operators
      const activePoolOperators = await this.poolOperatorModel
        .find(
          {
            poolId: poolOperator.poolId,
            operatorId: { $in: allActiveOperatorIds },
          },
          { operatorId: 1 },
        )
        .lean();

      const activePoolOperatorIds = new Set(
        activePoolOperators.map((op) => op.operatorId),
      );

      // ✅ Step 8B: Compute Rewards Based on Weighted Eff (Only for Active Pool Operators)
      const weightedPoolOperators = operatorsWithLuck.filter((op) =>
        activePoolOperatorIds.has(op.operatorId),
      );
      const totalPoolEff = weightedPoolOperators.reduce(
        (sum, op) => sum + op.weightedEff,
        0,
      );

      if (totalPoolEff === 0) {
        this.logger.warn(
          `⚠️ (distributeCycleRewards) No valid weighted EFF for pool reward distribution.`,
        );
        return;
      }

      const extractorReward = issuedHash * pool.rewardSystem.extractorOperator;
      const leaderReward = issuedHash * pool.rewardSystem.leader;
      const activePoolReward =
        issuedHash * pool.rewardSystem.activePoolOperators;

      // ✅ Step 8C: Compute Weighted Pool Rewards
      const weightedPoolRewards = weightedPoolOperators.map((operator) => ({
        operatorId: operator.operatorId,
        amount: (operator.weightedEff / totalPoolEff) * activePoolReward,
      }));

      // ✅ Step 8D: Store Rewards for Batch Update
      rewardData.push(
        { operatorId: extractorOperatorId, amount: extractorReward },
        { operatorId: pool.leaderId, amount: leaderReward },
        ...weightedPoolRewards,
      );

      this.logger.log(
        `✅ (distributeCycleRewards) POOL rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. Leader received ${leaderReward} $HASH.`,
      );
    }

    // ✅ Step 9: Batch Issue Rewards
    await this.batchIssueHashRewards(rewardData);

    const end = performance.now();
    this.logger.log(
      `✅ (distributeCycleRewards) Rewards distributed in ${(end - now).toFixed(2)}ms.`,
    );
  }

  /**
   * Batch issues $HASH rewards to operators at the end of a drilling cycle.
   */
  async batchIssueHashRewards(
    rewardData: { operatorId: Types.ObjectId; amount: number }[],
  ) {
    if (!rewardData.length) return;

    // Measure execution time
    const start = performance.now();

    // Process rewards in batches
    const batchPromises = [];

    for (const { operatorId, amount } of rewardData) {
      // Update Redis session
      batchPromises.push(
        this.drillingSessionService.updateSessionEarnedHash(operatorId, amount),
      );
    }

    // Also update MongoDB for historical records
    await this.drillingSessionModel.bulkWrite(
      rewardData.map(({ operatorId, amount }) => ({
        updateOne: {
          filter: { operatorId, endTime: null }, // ✅ Only update active sessions
          update: { $inc: { earnedHASH: amount } },
        },
      })),
    );

    // Wait for all Redis updates to complete
    await Promise.all(batchPromises);

    const end = performance.now();

    this.logger.log(
      `✅ (batchIssueHashRewards) Issued ${rewardData.length} rewards in ${
        end - start
      }ms.`,
    );
  }

  /**
   * Fetches the latest drilling cycle number from Redis.
   */
  async getCurrentCycleNumber(): Promise<
    ApiResponse<{
      cycleNumber: number;
    }>
  > {
    const cycle = await this.redisService.get(this.redisCycleKey);
    // return cycle ? parseInt(cycle, 10) : 0;
    return new ApiResponse<{
      cycleNumber: number;
    }>(200, `(getCurrentCycleNumber) Fetched.`, {
      cycleNumber: cycle ? parseInt(cycle, 10) : 0,
    });
  }

  /**
   * Resets the cycle number in Redis (only if required, for example for debugging/testing).
   */
  async resetCycleNumber(
    newCycleNumber: number,
    password: string,
  ): Promise<ApiResponse<null>> {
    if (password !== process.env.ADMIN_PASSWORD) {
      return new ApiResponse<null>(
        403,
        `(resetCycleNumber) Invalid password provided. Cycle number not reset.`,
      );
    }

    try {
      await this.redisService.set(
        this.redisCycleKey,
        newCycleNumber.toString(),
      );
      this.logger.warn(`🔄 Drilling Cycle Number Reset to: ${newCycleNumber}`);

      return new ApiResponse<null>(
        200,
        `(resetCycleNumber) Cycle number reset to ${newCycleNumber}.`,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(resetCycleNumber) Error resetting cycle number: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Returns the current status of the drilling cycle (either enabled or disabled).
   */
  async getCycleStatus(): Promise<
    ApiResponse<{
      cycleEnabled: boolean;
    }>
  > {
    return new ApiResponse<{ cycleEnabled: boolean }>(
      200,
      `(getCycleStatus) Cycle status fetched.`,
      { cycleEnabled: GAME_CONSTANTS.CYCLES.ENABLED },
    );
  }

  /**
   * Toggles the creation of new drilling cycles on or off.
   */
  toggleCycle(enabled: boolean, password: string): ApiResponse<null> {
    if (password !== process.env.ADMIN_PASSWORD) {
      return new ApiResponse<null>(
        403,
        `(toggleCycle) Invalid password provided. Cycle state not changed.`,
      );
    }

    GAME_CONSTANTS.CYCLES.ENABLED = enabled;
    this.logger.log(
      `🔄 Drilling Cycles ${enabled ? 'Enabled' : 'Disabled'} by password.`,
    );
    return new ApiResponse<null>(
      200,
      `(toggleCycle) Drilling Cycles are now ${enabled ? 'enabled' : 'disabled'}.`,
    );
  }

  /**
   * Depletes fuel for active operators (i.e. operators that have an active drilling session)
   * and replenishes fuel for inactive operators (i.e. operators that do not have an active drilling session).
   */
  async processFuelForAllOperators(currentCycleNumber: number) {
    const startTime = performance.now(); // ⏳ Start timing

    const activeOperatorIds =
      await this.drillingSessionService.fetchActiveOperatorIds();

    // Generate a random depletion/replenishment value
    const fuelUsed = this.operatorService.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
    );

    const fuelGained = this.operatorService.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.maxUnits,
    );

    // 🛠 Bulk update ACTIVE operators (deplete fuel)
    await this.operatorService.depleteFuel(activeOperatorIds, fuelUsed);

    // 🛠 Bulk update INACTIVE operators (replenish fuel)
    await this.operatorService.replenishFuel(activeOperatorIds, fuelGained);

    // **🔴 NEW: Stop drilling sessions for operators who drop below threshold**
    // ✅ Step 1: Find all operators whose fuel dropped below threshold
    const depletedOperatorIds =
      await this.operatorService.fetchDepletedOperatorIds(activeOperatorIds);

    // ✅ Step 2: Stop drilling sessions for those operators
    await this.drillingSessionService.stopDrillingForDepletedOperators(
      depletedOperatorIds,
      currentCycleNumber,
    );

    // ✅ Step 3: Broadcast stop drilling event to depleted operators
    this.drillingGateway.broadcastStopDrilling(depletedOperatorIds, {
      message: 'Drilling stopped due to insufficient fuel',
      reason: 'fuel_depleted',
    });

    const endTime = performance.now(); // ⏳ End timing
    const executionTime = (endTime - startTime).toFixed(2);

    this.logger.log(
      `⚡ Fuel Processing Completed:
     ⛏ Depleted ${fuelUsed} fuel for ${activeOperatorIds.size} active operators.
     🔋 Replenished ${fuelGained} fuel for inactive operators.
     🛑 Stopped drilling sessions for operators who dropped below fuel threshold.
     ⏱ Execution Time: ${executionTime}ms`,
    );
  }
}
