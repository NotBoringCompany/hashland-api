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
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';
import { Pool } from 'src/pools/schemas/pool.schema';
import { OperatorService } from 'src/operators/operator.service';
import { DrillService } from './drill.service';
import { DrillingGatewayService } from 'src/gateway/drilling.gateway.service';
import { DrillingSession } from './schemas/drilling-session.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { DrillingGateway } from 'src/gateway/drilling.gateway';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { HashReserveService } from 'src/hash-reserve/hash-reserve.service';
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
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    @InjectModel(Pool.name) private poolModel: Model<Pool>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    private readonly operatorWalletService: OperatorWalletService,
    private readonly redisService: RedisService,
    private readonly drillingSessionService: DrillingSessionService,
    private readonly drillService: DrillService,
    private readonly operatorService: OperatorService,
    private readonly drillingGatewayService: DrillingGatewayService,
    private readonly drillingGateway: DrillingGateway,
    private readonly hashReserveService: HashReserveService,
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

    // ✅ Step 1: Fetch issued HASH from Redis
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${cycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseFloat(issuedHASHStr) : 0; // Ensure it's a number

    // ✅ Step 2: Select extractor
    const extractorData = await this.drillService.selectExtractor();
    let finalExtractorOperatorId: Types.ObjectId | null = null;

    if (extractorData) {
      const extractorOperatorId = extractorData.drillOperatorId;

      // ✅ Step 2B: Fetch operator's stored asset equity **and their wallets** in a single query
      const [extractorOperator, extractorOperatorWallets] = await Promise.all([
        this.operatorService.findById(extractorOperatorId, {
          assetEquity: 1,
        }),
        this.operatorWalletService.getOperatorWallets(extractorOperatorId, {
          address: 1,
          chain: 1,
        }),
      ]);

      if (!extractorOperator) {
        this.logger.warn(
          `(endCurrentCycle) Extractor operator ${extractorOperatorId} not found. Skipping extractor.`,
        );
      } else {
        const storedAssetEquity = extractorOperator.assetEquity;
        const minThreshold =
          GAME_CONSTANTS.EXTRACTOR.OPERATOR_MINIMUM_ASSET_EQUITY_THRESHOLD *
          storedAssetEquity;

        // ✅ Fetch real-time asset equity **only if operator has wallets**
        let currentEquity = 0;
        if (extractorOperatorWallets.length > 0) {
          currentEquity =
            await this.operatorWalletService.fetchTotalBalanceForWallets(
              extractorOperatorWallets.map((wallet) => ({
                address: wallet.address,
                chain: wallet.chain as AllowedChain,
              })),
            );
        }

        // ✅ Ensure operator meets minimum equity threshold
        if (currentEquity >= minThreshold) {
          finalExtractorOperatorId = extractorData.drillId; // ✅ Extractor is valid, add the extractor operator.
        } else {
          this.logger.warn(
            `(endCurrentCycle) Extractor operator ${extractorOperatorId} has dropped below the asset equity threshold. Skipping extractor for this cycle.`,
          );
        }
      }
    } else {
      this.logger.warn(
        `(endCurrentCycle) No valid extractor drill found. Skipping extractor distribution.`,
      );
    }

    // ✅ Step 3: Distribute rewards to extractor operator and active operators (extractorOperatorId could be null)
    await this.distributeCycleRewards(finalExtractorOperatorId, issuedHASH);

    // ✅ Step 4: Process Fuel for ALL Operators
    await this.processFuelForAllOperators(cycleNumber);

    // ✅ Step 5: Update the cycle with extractor ID (can be null)
    await this.drillingCycleModel.updateOne(
      { cycleNumber },
      { extractorId: extractorData?.drillId || null }, // ✅ Store null if no extractor is chosen
    );

    const endTime = performance.now();
    this.logger.log(
      `✅ (endCurrentCycle) Cycle #${cycleNumber} processing completed in ${(endTime - startTime).toFixed(2)}ms.`,
    );
  }

  /**
   * Distributes $HASH rewards to operators at the end of a drilling cycle.
   */
  async distributeCycleRewards(
    extractorOperatorId: Types.ObjectId | null, // ✅ Extractor operator ID can be null
    issuedHash: number,
  ) {
    const now = performance.now();
    const rewardData: { operatorId: Types.ObjectId; amount: number }[] = [];

    // ✅ Step 1: Fetch All Active Operators' IDs
    const allActiveOperatorIds =
      await this.drillingSessionService.fetchActiveDrillingSessionOperatorIds();
    if (allActiveOperatorIds.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No active operators found for reward distribution.`,
      );
      return;
    }

    // ✅ Step 2: Fetch Active Operators' Data (Cumulative Eff, Eff Multiplier)
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

    // ✅ Step 3: Apply Luck Factor & Compute Weighted Eff
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

    // ✅ Step 4: Compute Total Weighted Eff Sum
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

    if (extractorOperatorId === null) {
      // 🟡 **No Extractor Selected - Reserve Extractor's HASH**
      const extractorHashAllocation =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;
      await this.hashReserveService.addToHASHReserve(extractorHashAllocation);

      // Active operator reward share
      const activeOperatorsReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

      // ✅ Compute Each Operator’s Reward Share Based on Weighted Eff
      // This includes the supposed extractor as well even if they didn't get selected due to validation issues.
      const weightedRewards = operatorsWithLuck.map((operator) => ({
        operatorId: operator.operatorId,
        amount:
          (operator.weightedEff / totalWeightedEff) * activeOperatorsReward,
      }));

      rewardData.push(...weightedRewards);

      this.logger.warn(
        `⚠️ (distributeCycleRewards) No extractor selected. Only active operators received rewards.`,
      );
    } else {
      // ✅ Step 5: Check If Extractor is in a Pool
      const poolOperator = await this.poolOperatorModel
        .findOne({ operatorId: extractorOperatorId })
        .select('poolId')
        .lean();
      const isSoloOperator = !poolOperator;

      if (isSoloOperator) {
        // 🟢 **SOLO OPERATOR REWARD LOGIC**
        const extractorReward =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;
        const activeOperatorsReward =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

        // ✅ Compute Each Operator’s Reward Share Based on Weighted Eff
        const weightedRewards = operatorsWithLuck.map((operator) => ({
          operatorId: operator.operatorId,
          amount:
            (operator.weightedEff / totalWeightedEff) * activeOperatorsReward,
        }));

        rewardData.push(
          { operatorId: extractorOperatorId, amount: extractorReward }, // Extractor Reward
          ...weightedRewards, // Active Operators' Rewards
        );

        this.logger.log(
          `✅ (distributeCycleRewards) SOLO rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH.`,
        );
      } else {
        // 🟢 **POOL OPERATOR REWARD LOGIC**
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

        // ✅ Step 6: Get Active Pool Operators
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

        // ✅ Step 7: Compute Rewards Based on Weighted Eff (Only for Active Pool Operators)
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

        const extractorReward =
          issuedHash * pool.rewardSystem.extractorOperator;
        const leaderReward = issuedHash * pool.rewardSystem.leader;
        const activePoolReward =
          issuedHash * pool.rewardSystem.activePoolOperators;

        // ✅ Compute Weighted Pool Rewards
        const weightedPoolRewards = weightedPoolOperators.map((operator) => ({
          operatorId: operator.operatorId,
          amount: (operator.weightedEff / totalPoolEff) * activePoolReward,
        }));

        rewardData.push(
          { operatorId: extractorOperatorId, amount: extractorReward },
          { operatorId: pool.leaderId, amount: leaderReward },
          ...weightedPoolRewards,
        );

        this.logger.log(
          `✅ (distributeCycleRewards) POOL rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. Leader received ${leaderReward} $HASH.`,
        );
      }
    }

    // ✅ Step 8: Batch Issue Rewards
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
  async processFuelForAllOperators(currentCycleNumber: number): Promise<void> {
    const startTime = performance.now();

    try {
      // Fetch active operator IDs
      const activeOperatorIds =
        await this.drillingSessionService.fetchActiveOperatorIds();

      // Generate random fuel values based on game constants
      const fuelUsed = this.operatorService.getRandomFuelValue(
        GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.minUnits,
        GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
      );

      const fuelGained = this.operatorService.getRandomFuelValue(
        GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits,
        GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.maxUnits,
      );

      // Process fuel updates in parallel
      const [, , depletedOperatorIds] = await Promise.all([
        // Deplete fuel for active operators
        this.operatorService.depleteFuel(activeOperatorIds, fuelUsed),

        // Replenish fuel for inactive operators
        this.operatorService.replenishFuel(activeOperatorIds, fuelGained),

        // Find operators whose fuel dropped below threshold
        this.operatorService.fetchDepletedOperatorIds(activeOperatorIds),
      ]);

      // Handle depleted operators
      if (depletedOperatorIds.length > 0) {
        await Promise.all([
          // Stop drilling sessions for depleted operators
          this.drillingSessionService.stopDrillingForDepletedOperators(
            depletedOperatorIds,
            currentCycleNumber,
          ),

          // Broadcast stop drilling event to depleted operators
          this.drillingGateway.broadcastStopDrilling(depletedOperatorIds, {
            message: 'Drilling stopped due to insufficient fuel',
            reason: 'fuel_depleted',
          }),
        ]);
      }

      const endTime = performance.now();
      const executionTime = (endTime - startTime).toFixed(2);

      this.logger.log(
        `⚡ Fuel Processing Completed:
         ⛏ Depleted ${fuelUsed} fuel for ${activeOperatorIds.size} active operators.
         🔋 Replenished ${fuelGained} fuel for inactive operators.
         🛑 Stopped drilling for ${depletedOperatorIds.length} operators below fuel threshold.
         ⏱ Execution Time: ${executionTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing fuel: ${error.message}`,
        error.stack,
      );
      // Consider implementing a retry mechanism or fallback strategy
      // Optionally, rethrow the error if it should be handled by the caller
    }
  }
}
