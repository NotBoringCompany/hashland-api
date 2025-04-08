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
import { DrillingCycleRewardShare } from './schemas/drilling-crs.schema';
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
    @InjectModel(DrillingCycleRewardShare.name)
    private drillingCycleRewardShareModel: Model<DrillingCycleRewardShare>,
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
   * Gets a cycle's extended data, such as the extractor-related data and reward share data.
   */
  async getCycleExtendedData(
    cycleNumber: number,
    operatorId: Types.ObjectId,
  ): Promise<
    ApiResponse<{
      extractorOperatorUsername: string | null;
      extractorOperatorRewardShare: number;
      ownRewardShare: number;
    }>
  > {
    try {
      // Get the cycle data only related to the extractor
      const cycle = await this.drillingCycleModel
        .findOne(
          { cycleNumber },
          {
            extractorOperatorId: 1,
          },
        )
        .lean();

      if (!cycle) {
        this.logger.warn(`⚠️ Cycle #${cycleNumber} not found in MongoDB.`);
        return new ApiResponse(404, 'Cycle not found', null);
      }

      // Get the extractor operator's username
      const extractorOperator = await this.operatorModel
        .findOne({
          _id: cycle.extractorOperatorId,
        })
        .lean();

      const extractorOperatorUsername = extractorOperator?.username || null;

      // Get the operator and the extractor operator's reward share
      const [operatorRewardShare, extractorRewardShare] = await Promise.all([
        this.drillingCycleRewardShareModel
          .findOne({ cycleNumber, operatorId }, { amount: 1 })
          .lean(),
        this.drillingCycleRewardShareModel
          .findOne(
            { cycleNumber, operatorId: cycle.extractorOperatorId },
            { amount: 1 },
          )
          .lean(),
      ]);

      const ownRewardShare = operatorRewardShare?.amount || 0;
      const extractorOperatorRewardShare = extractorRewardShare?.amount || 0;

      return new ApiResponse(200, 'Cycle data fetched successfully', {
        extractorOperatorUsername,
        extractorOperatorRewardShare,
        ownRewardShare,
      });
    } catch (err: any) {
      this.logger.error(
        `❌ Error fetching cycle reward data for operator ${operatorId}: ${err.message}`,
      );
      throw new InternalServerErrorException(
        new ApiResponse(500, 'Internal Server Error', err.message),
      );
    }
  }

  /**
   * Initializes the cycle number in Redis if not already set.
   */
  async initializeCycleNumber() {
    try {
      // Check if cycle number exists in Redis
      const cycleNumber = await this.redisService.get(this.redisCycleKey);

      if (!cycleNumber) {
        // First try to find the latest cycle in MongoDB
        const latestCycle = await this.drillingCycleModel
          .findOne()
          .sort({ cycleNumber: -1 })
          .exec();

        // Initialize with either the next cycle number or 1 if no cycles exist
        const newCycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;

        // If we found an existing cycle, verify it with a manual count to ensure consistency
        if (latestCycle) {
          // Get count of all cycles to verify that there's no gap
          const totalCycles = await this.drillingCycleModel.countDocuments();

          // If we have a mismatch between latest cycle number and total count, log a warning
          if (latestCycle.cycleNumber !== totalCycles) {
            this.logger.warn(
              `⚠️ Cycle number inconsistency detected: Latest cycle is #${latestCycle.cycleNumber}, but there are ${totalCycles} total cycles. This may indicate missing cycles.`,
            );
          }
        }

        // Store the new cycle number in Redis
        await this.redisService.set(
          this.redisCycleKey,
          newCycleNumber.toString(),
        );
        this.logger.log(`🔄 Redis Cycle Number Initialized: ${newCycleNumber}`);
      } else {
        // Verify that the Redis cycle number matches what's in MongoDB
        const redisCycleNumber = parseInt(cycleNumber, 10);
        const expectedNextCycle = redisCycleNumber + 1; // The next cycle we'll create

        // Find the latest cycle in MongoDB to compare
        const latestCycle = await this.drillingCycleModel
          .findOne()
          .sort({ cycleNumber: -1 })
          .exec();

        if (latestCycle) {
          // Check if there's a mismatch between Redis and MongoDB
          if (latestCycle.cycleNumber >= expectedNextCycle) {
            this.logger.warn(
              `⚠️ Redis cycle number (${redisCycleNumber}) is behind MongoDB's latest cycle (${latestCycle.cycleNumber}). This may cause issues.`,
            );
          } else if (latestCycle.cycleNumber < redisCycleNumber - 1) {
            this.logger.warn(
              `⚠️ Gap detected between Redis cycle number (${redisCycleNumber}) and MongoDB's latest cycle (${latestCycle.cycleNumber}). This may indicate missing cycles.`,
            );
          } else {
            this.logger.log(
              `✅ Redis cycle number (${redisCycleNumber}) and MongoDB's latest cycle (${latestCycle.cycleNumber}) are in sync.`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error initializing cycle number: ${error.message}`);
      this.logger.error(error.stack);
      // Continue execution despite this error - the system can try to recover
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

      // Create the drilling cycle with active operator count and store the result
      const newCycle = await this.drillingCycleModel.create({
        cycleNumber: newCycleNumber,
        startTime: now,
        endTime: new Date(now.getTime() + this.cycleDuration),
        activeOperators, // Track active operators
        extractorId: null,
        difficulty: 0,
        issuedHASH: GAME_CONSTANTS.HASH_ISSUANCE.CYCLE_HASH_ISSUANCE,
      });

      // Verify that we have a valid cycle object with cycleNumber
      if (!newCycle || !newCycle.cycleNumber) {
        throw new Error(
          `Failed to create drilling cycle #${newCycleNumber} in MongoDB`,
        );
      }

      const endFetchTime = performance.now();

      this.logger.log(
        `⏳ (Performance) Drilling Cycle #${newCycleNumber} setup with ${activeOperators} operators took ${endFetchTime - startFetchTime}ms.`,
      );

      return newCycleNumber;
    } catch (error) {
      this.logger.error(`❌ Error Creating Drilling Cycle: ${error.message}`);
      this.logger.error(error.stack);

      // Try to recover - check if the cycle was actually created despite the error
      try {
        const existingCycle = await this.drillingCycleModel.findOne({
          cycleNumber: newCycleNumber,
        });

        if (existingCycle) {
          this.logger.warn(
            `⚠️ Cycle #${newCycleNumber} exists in MongoDB despite error - continuing operation`,
          );
          return newCycleNumber;
        }
      } catch (verifyError) {
        this.logger.error(
          `❌ Error verifying cycle existence: ${verifyError.message}`,
        );
      }

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
    // Store the total weighted efficiency from extractor selection
    const totalWeightedEff = extractorData?.totalWeightedEff || 0;

    if (extractorData) {
      const extractorOperatorId = extractorData.drillOperatorId;

      // ✅ Step 2B: Fetch operator's stored asset equity **and their wallets** in a single query
      const [extractorOperator, extractorOperatorWallets] = await Promise.all([
        this.operatorService.findById(extractorOperatorId, {
          assetEquity: 1,
          username: 1, // Add username to the query
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
          finalExtractorOperatorId = extractorData.drillOperatorId; // ✅ Extractor is valid, add the extractor operator.
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
    const rewardShares = await this.distributeCycleRewards(
      finalExtractorOperatorId,
      issuedHASH,
    );

    // ✅ Step 4: Process Fuel for ALL Operators
    await this.processFuelForAllOperators(cycleNumber);

    // ✅ Step 5: Update the cycle
    const latestCycle = await this.drillingCycleModel.findOneAndUpdate(
      { cycleNumber },
      {
        extractorId: extractorData?.drillId || null, // ✅ Store null if no extractor is chosen
        extractorOperatorId: finalExtractorOperatorId,
        totalWeightedEff,
      },
      { new: true },
    );

    // We will create a batch operation to create the reward share documents to `DrillingCycleRewardShares`.
    const rewardShareDocs = rewardShares.map((reward) => ({
      cycleNumber,
      operatorId: reward.operatorId,
      amount: reward.amount,
    }));

    this.logger.debug(
      `(endCurrentCycle) Reward Share Docs:`,
      JSON.stringify(rewardShareDocs, null, 2),
    );

    await this.drillingCycleRewardShareModel.insertMany(rewardShareDocs);

    // Check if the cycle document was found and updated
    if (!latestCycle) {
      this.logger.error(
        `❌ (endCurrentCycle) Failed to update cycle #${cycleNumber} - document not found in MongoDB`,
      );

      return;
    }

    // ✅ Step 6: Complete any stopping sessions
    const completionResult =
      await this.drillingSessionService.completeStoppingSessionsForEndCycle(
        cycleNumber,
      );

    // Notify operators that their sessions were completed
    if (completionResult.operatorIds.length > 0) {
      this.drillingGatewayService.notifySessionsCompleted(
        completionResult.operatorIds,
        cycleNumber,
        completionResult.earnedHASH,
      );
    }

    // ✅ Step 7: Send WebSocket notification about the latest cycle
    await this.drillingGateway.storeLatestCycleInRedis(latestCycle);

    // Send WebSocket notification with reward shares for each operator
    await this.drillingGatewayService.notifyNewCycle(latestCycle, rewardShares);

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
  ): Promise<{ operatorId: Types.ObjectId; amount: number }[]> {
    const now = performance.now();
    const rewardData: { operatorId: Types.ObjectId; amount: number }[] = [];
    const rewardShares: {
      operatorId: Types.ObjectId;
      amount: number;
    }[] = [];

    // ✅ Step 1: Fetch All Active Operators' IDs
    const allActiveOperatorIds =
      await this.drillingSessionService.fetchActiveDrillingSessionOperatorIds();
    if (allActiveOperatorIds.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No active operators found for reward distribution.`,
      );
      return [];
    }

    // ✅ Step 2: Fetch Active Operators' Data (Cumulative Eff, Eff Multiplier)
    const activeOperators = await this.operatorModel
      .find(
        { _id: { $in: allActiveOperatorIds } },
        { _id: 1, cumulativeEff: 1, effMultiplier: 1, username: 1 },
      )
      .lean();

    if (activeOperators.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No valid active operators.`,
      );
      return [];
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
      return [];
    }

    // Track pools for reward updates
    const poolRewards = new Map<string, number>();
    const poolOperatorRewards = new Map<string, number>();

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

      // ✅ Compute Each Operator's Reward Share Based on Weighted Eff
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
        .findOne({ operator: extractorOperatorId })
        .select('pool')
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

        // ✅ Compute Each Operator's Reward Share Based on Weighted Eff
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
          .findById(poolOperator.pool)
          .select('leaderId rewardSystem')
          .lean();
        if (!pool) {
          this.logger.error(
            `(distributeCycleRewards) Pool not found for extractor operator: ${extractorOperatorId}`,
          );
          return [];
        }

        // Track total pool rewards
        let totalPoolReward = 0;

        // ✅ Step 6: Get Active Pool Operators
        const activePoolOperators = await this.poolOperatorModel
          .find(
            {
              pool: poolOperator.pool,
              operator: { $in: allActiveOperatorIds },
            },
            { operator: 1 },
          )
          .lean();

        const activePoolOperatorIds = new Set(
          activePoolOperators.map((op) => op.operator.toString()),
        );

        // ✅ Step 7: Compute Rewards Based on Weighted Eff (Only for Active Pool Operators)
        const weightedPoolOperators = operatorsWithLuck.filter((op) =>
          activePoolOperatorIds.has(op.operatorId.toString()),
        );
        const totalPoolEff = weightedPoolOperators.reduce(
          (sum, op) => sum + op.weightedEff,
          0,
        );

        if (totalPoolEff === 0) {
          this.logger.warn(
            `⚠️ (distributeCycleRewards) No valid weighted EFF for pool reward distribution.`,
          );
          return [];
        }

        const extractorReward =
          issuedHash * pool.rewardSystem.extractorOperator;
        const leaderReward = issuedHash * pool.rewardSystem.leader;
        const activePoolReward =
          issuedHash * pool.rewardSystem.activePoolOperators;

        // Update total pool reward
        totalPoolReward = extractorReward + leaderReward + activePoolReward;
        poolRewards.set(poolOperator.pool.toString(), totalPoolReward);

        // Track if extractor is in the same pool and add their reward
        if (activePoolOperatorIds.has(extractorOperatorId.toString())) {
          const poolOpKey = `${extractorOperatorId.toString()}_${poolOperator.pool.toString()}`;
          poolOperatorRewards.set(poolOpKey, extractorReward);
          this.logger.debug(
            `Added extractor reward ${extractorReward} HASH to ${poolOpKey}`,
          );
        }

        // Track leader reward if leader is in the same pool
        if (
          pool.leaderId &&
          activePoolOperatorIds.has(pool.leaderId.toString())
        ) {
          const poolOpKey = `${pool.leaderId.toString()}_${poolOperator.pool.toString()}`;
          const existingReward = poolOperatorRewards.get(poolOpKey) || 0;
          const newReward = existingReward + leaderReward;
          poolOperatorRewards.set(poolOpKey, newReward);
          this.logger.debug(
            `Added leader reward ${leaderReward} HASH to ${poolOpKey}, total: ${newReward}`,
          );
        }

        // ✅ Compute Weighted Pool Rewards
        const weightedPoolRewards = weightedPoolOperators.map((operator) => {
          const opReward =
            (operator.weightedEff / totalPoolEff) * activePoolReward;

          // Track individual pool operator rewards
          const poolOpKey = `${operator.operatorId.toString()}_${poolOperator.pool.toString()}`;
          const existingReward = poolOperatorRewards.get(poolOpKey) || 0;
          const newReward = existingReward + opReward;

          poolOperatorRewards.set(poolOpKey, newReward);
          this.logger.debug(
            `Added pool weighted reward ${opReward.toFixed(4)} HASH to ${poolOpKey}, total: ${newReward.toFixed(4)}`,
          );

          return {
            operatorId: operator.operatorId,
            amount: opReward,
          };
        });

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

    // ✅ Step 9: Update total rewards for pools and pool operators
    if (poolRewards.size > 0 || poolOperatorRewards.size > 0) {
      await this.updatePoolAndOperatorRewards(poolRewards, poolOperatorRewards);
    }

    // ✅ Step 10: Group rewards by operator ID and remove null entries
    const groupedRewardMap = new Map<string, number>();

    // Group rewardData by operatorId and sum the amounts
    for (const reward of rewardData) {
      // Skip null or undefined operatorId
      if (!reward.operatorId) continue;

      const operatorIdString = reward.operatorId.toString();
      const currentTotal = groupedRewardMap.get(operatorIdString) || 0;
      groupedRewardMap.set(operatorIdString, currentTotal + reward.amount);
    }

    // Convert the grouped map to rewardShares
    for (const [operatorIdString, amount] of groupedRewardMap.entries()) {
      rewardShares.push({
        operatorId: new Types.ObjectId(operatorIdString),
        amount,
      });
    }

    this.logger.debug(
      `Reward Shares: ${JSON.stringify(rewardShares, null, 2)}`,
    );

    const end = performance.now();
    this.logger.log(
      `✅ (distributeCycleRewards) Rewards distributed in ${(end - now).toFixed(2)}ms.`,
    );

    return rewardShares;
  }

  /**
   * Updates the total rewards for pools and pool operators in a single operation.
   * This method efficiently updates the total rewards without causing circular dependencies.
   */
  private async updatePoolAndOperatorRewards(
    poolRewards: Map<string, number>,
    poolOperatorRewards: Map<string, number>,
  ): Promise<void> {
    try {
      // Log the rewards for debugging
      this.logger.debug(
        `Updating pool rewards: ${JSON.stringify(Array.from(poolRewards.entries()))}`,
      );
      this.logger.debug(
        `Updating pool operator rewards: ${JSON.stringify(Array.from(poolOperatorRewards.entries()))}`,
      );

      // Create bulkWrite operations for pools
      const poolBulkOps = Array.from(poolRewards.entries()).map(
        ([poolId, amount]) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(poolId) },
            update: { $inc: { totalRewards: amount } },
          },
        }),
      );

      // Create bulkWrite operations for pool operators
      const poolOperatorBulkOps = Array.from(poolOperatorRewards.entries()).map(
        ([key, amount]) => {
          const [operatorId, poolId] = key.split('_');
          return {
            updateOne: {
              filter: {
                operator: new Types.ObjectId(operatorId),
                pool: new Types.ObjectId(poolId),
              },
              update: { $inc: { totalRewards: amount } },
            },
          };
        },
      );

      // Execute bulkWrite operations in parallel
      const updatePromises = [];

      if (poolBulkOps.length > 0) {
        updatePromises.push(this.poolModel.bulkWrite(poolBulkOps));
        this.logger.log(
          `⏳ Updating total rewards for ${poolBulkOps.length} pools`,
        );
      }

      if (poolOperatorBulkOps.length > 0) {
        updatePromises.push(
          this.poolOperatorModel.bulkWrite(poolOperatorBulkOps),
        );
        this.logger.log(
          `⏳ Updating total rewards for ${poolOperatorBulkOps.length} pool operators`,
        );
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      this.logger.log(
        `✅ Successfully updated rewards for ${poolBulkOps.length} pools and ${poolOperatorBulkOps.length} pool operators`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error updating pool and operator rewards: ${error.message}`,
        error.stack,
      );
      // Don't rethrow to avoid breaking the cycle processing
    }
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

      // Validate fuel values to prevent NaN issues
      if (isNaN(fuelUsed) || isNaN(fuelGained)) {
        throw new Error(
          `Invalid fuel values generated: fuelUsed=${fuelUsed}, fuelGained=${fuelGained}`,
        );
      }

      this.logger.log(
        `Processing fuel: depleting ${fuelUsed} from active operators, replenishing ${fuelGained} to inactive operators`,
      );

      // Process fuel updates in parallel - only operators that need notifications are returned
      let depletedOperators = [],
        replenishedOperators = [],
        depletedOperatorIds = [];
      try {
        [depletedOperators, replenishedOperators, depletedOperatorIds] =
          await Promise.all([
            // Deplete fuel for active operators - returns all updated operators
            this.operatorService.depleteFuel(activeOperatorIds, fuelUsed),

            // Replenish fuel for inactive operators - returns all updated operators
            this.operatorService.replenishFuel(activeOperatorIds, fuelGained),

            // Find operators whose fuel dropped below threshold
            this.operatorService.fetchDepletedOperatorIds(activeOperatorIds),
          ]);
      } catch (fuelProcessingError) {
        this.logger.error(
          `Failed to process fuel operations: ${fuelProcessingError.message}`,
          fuelProcessingError.stack,
        );
        // Continue execution with empty arrays to avoid breaking the cycle
        depletedOperators = [];
        replenishedOperators = [];
        depletedOperatorIds = [];
      }

      // Notify operators about fuel updates - send to all operators for real-time updates
      try {
        await Promise.all([
          // Notify active operators about fuel depletion
          this.drillingGatewayService.notifyFuelUpdates(
            depletedOperators,
            fuelUsed,
            'depleted',
          ),

          // Notify inactive operators about fuel replenishment
          this.drillingGatewayService.notifyFuelUpdates(
            replenishedOperators,
            fuelGained,
            'replenished',
          ),
        ]);
      } catch (notificationError) {
        this.logger.error(
          `Failed to send fuel notifications: ${notificationError.message}`,
          notificationError.stack,
        );
        // Continue execution as notifications are not critical
      }

      // Handle depleted operators
      if (depletedOperatorIds.length > 0) {
        try {
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
        } catch (stopDrillingError) {
          this.logger.error(
            `Failed to stop drilling for depleted operators: ${stopDrillingError.message}`,
            stopDrillingError.stack,
          );
        }
      }

      const endTime = performance.now();
      const executionTime = (endTime - startTime).toFixed(2);

      this.logger.log(
        `⚡ Fuel Processing Completed:
         ⛏ Depleted ${fuelUsed} fuel for ${activeOperatorIds.size} active operators.
         🔋 Replenished ${fuelGained} fuel for inactive operators.
         🛑 Stopped drilling for ${depletedOperatorIds.length} operators below fuel threshold.
         📢 Sent fuel update notifications to ${depletedOperators.length + replenishedOperators.length} operators.
         ⏱ Execution Time: ${executionTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing fuel: ${error.message}`,
        error.stack,
      );
      // The error is caught here to prevent the whole cycle process from failing
      // We log it but don't rethrow so the rest of the cycle operations can continue
    }
  }
}
