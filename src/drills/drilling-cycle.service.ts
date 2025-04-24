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
   * Checks if the issued HASH data is correct.
   */
  async checkIssuedHASHData() {
    const operatorResult = await this.operatorModel.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEarnedHASH' } } },
    ]);
    const totalFromOperators = operatorResult[0]?.total || 0;

    const totalFromReserve =
      await this.hashReserveService.getTotalHASHReserved();

    const latestCycleNumber = await this.redisService.get(
      'drilling-cycle:current',
    );

    const correctIssuedHASHResult = await this.drillingCycleModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$issuedHASH' },
        },
      },
    ]);
    const correctIssuedHASH = correctIssuedHASHResult[0]?.total || 0;

    return {
      cycle: latestCycleNumber,
      totalIssuedHASH: totalFromOperators + totalFromReserve,
      correctIssuedHASH,
    };
  }

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

      const extractorOperatorUsername =
        extractorOperator?.usernameData.username || null;

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

    // Fetch $HASH issuance. Checks epoch to ensure proper epoch issuance is used.
    const initialIssuance = GAME_CONSTANTS.CYCLES.GENESIS_EPOCH_HASH_ISSUANCE;
    const halvingInterval = GAME_CONSTANTS.CYCLES.EPOCH_CYCLE_COUNT;
    const epoch = Math.floor((newCycleNumber - 1) / halvingInterval);
    const issuedHASH = Math.max(
      1, // Minimum issuance is 1
      Math.floor(initialIssuance / Math.pow(2, epoch)), // Halved issuance for each epoch
    );

    this.logger.debug(
      `💰 (createDrillingCycle) Cycle #${newCycleNumber} HASH issuance: ${issuedHASH}`,
    );

    // Store in Redis for fast access
    await this.redisService.set(
      `drilling-cycle:${newCycleNumber}:issuedHASH`,
      issuedHASH.toString(),
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

      // Recalibrate session counters to ensure accurate counts
      await this.drillingSessionService.recalibrateSessionCounters();

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
        issuedHASH,
      });

      // Verify that we have a valid cycle object with cycleNumber
      if (!newCycle || !newCycle.cycleNumber) {
        throw new Error(
          `Failed to create drilling cycle #${newCycleNumber} in MongoDB`,
        );
      }

      const endFetchTime = performance.now();

      this.logger.log(
        `⏳ (createDrillingCycle) Drilling Cycle #${newCycleNumber} setup with ${activeOperators} operators took ${endFetchTime - startFetchTime}ms.`,
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

    // Check if the cycle exists in the database before proceeding
    const cycleExistsTime = performance.now();
    const cycleExists = await this.drillingCycleModel.exists({ cycleNumber });
    this.logger.debug(
      `⏱️ Step 0 (Check cycle existence): ${(performance.now() - cycleExistsTime).toFixed(2)}ms`,
    );

    if (!cycleExists) {
      this.logger.warn(
        `⚠️ (endCurrentCycle) Cycle #${cycleNumber} not found in database. Skipping cycle processing.`,
      );
      return;
    }

    // ✅ Step 1: Fetch issued HASH from Redis
    const fetchHashTime = performance.now();
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${cycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseFloat(issuedHASHStr) : 0; // Ensure it's a number
    this.logger.debug(
      `⏱️ Step 1 (Fetch issued HASH): ${(performance.now() - fetchHashTime).toFixed(2)}ms`,
    );

    // ✅ Step 2: Select extractor
    const selectExtractorTime = performance.now();
    const extractorData = await this.drillService.selectExtractor();
    // Store the total weighted efficiency from extractor selection
    const totalWeightedEff = extractorData?.totalWeightedEff || 0;

    let extractorOperatorId: Types.ObjectId | null = null;

    if (extractorData) {
      extractorOperatorId = extractorData.drillOperatorId ?? null;
    } else {
      this.logger.warn(
        `(endCurrentCycle) No valid extractor drill found. Skipping extractor distribution.`,
      );
    }
    this.logger.debug(
      `⏱️ Step 2 (Select extractor): ${(performance.now() - selectExtractorTime).toFixed(2)}ms`,
    );

    // ✅ Step 3: Distribute rewards to extractor operator and active operators (extractorOperatorId could be null)
    const distributeRewardsTime = performance.now();
    const rewardShares = await this.distributeCycleRewards(
      extractorOperatorId,
      issuedHASH,
    );
    this.logger.debug(
      `⏱️ Step 3 (Distribute rewards): ${(performance.now() - distributeRewardsTime).toFixed(2)}ms`,
    );

    // ✅ Step 4: Process Fuel for ALL Operators
    const processFuelTime = performance.now();
    await this.processFuelForAllOperators();
    this.logger.debug(
      `⏱️ Step 4 (Process fuel): ${(performance.now() - processFuelTime).toFixed(2)}ms`,
    );

    // ✅ Step 5: Update the cycle
    const updateCycleTime = performance.now();
    const latestCycle = await this.drillingCycleModel.findOneAndUpdate(
      { cycleNumber },
      {
        extractorId: extractorData?.drillId || null, // ✅ Store null if no extractor is chosen
        extractorOperatorId,
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

    await this.drillingCycleRewardShareModel.insertMany(rewardShareDocs);
    this.logger.debug(
      `⏱️ Step 5 (Update cycle and store reward shares): ${(performance.now() - updateCycleTime).toFixed(2)}ms`,
    );

    // Check if the cycle document was found and updated
    if (!latestCycle) {
      this.logger.error(
        `❌ (endCurrentCycle) Failed to update cycle #${cycleNumber} - document not found in MongoDB`,
      );

      return;
    }

    // Recalibrate session counters to ensure accuracy
    const recalibrateTime = performance.now();
    await this.drillingSessionService.recalibrateSessionCounters();
    this.logger.debug(
      `⏱️ Step 5.1 (Recalibrate session counters): ${(performance.now() - recalibrateTime).toFixed(2)}ms`,
    );

    // ✅ Step 6: Complete any stopping sessions
    const completeSessionsTime = performance.now();
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
    this.logger.debug(
      `⏱️ Step 6 (Complete stopping sessions): ${(performance.now() - completeSessionsTime).toFixed(2)}ms`,
    );

    // ✅ Step 7: Send WebSocket notification about the latest cycle
    const notificationsTime = performance.now();
    await this.drillingGateway.storeLatestCycleInRedis(latestCycle);

    // Send WebSocket notification with reward shares for each operator
    await this.drillingGatewayService.notifyNewCycle(latestCycle, rewardShares);
    this.logger.debug(
      `⏱️ Step 7 (Send WebSocket notifications): ${(performance.now() - notificationsTime).toFixed(2)}ms`,
    );

    const endTime = performance.now();
    const totalExecutionTime = endTime - startTime;

    this.logger.log(
      `✅ (endCurrentCycle) Cycle #${cycleNumber} processing completed in ${totalExecutionTime.toFixed(2)}ms.`,
    );
  }

  /**
   * Distributes $HASH rewards to operators at the end of a drilling cycle.
   */
  async distributeCycleRewards(
    extractorOperatorId: Types.ObjectId | null, // ✅ Extractor operator ID can be null
    issuedHash: number,
  ): Promise<{ operatorId: Types.ObjectId; amount: number }[]> {
    const startTime = performance.now();
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
    }

    // ✅ Step 2: Fetch Active Operators' Data (Cumulative Eff, Eff Multiplier)
    const activeOperators = await this.operatorModel
      .find(
        { _id: { $in: allActiveOperatorIds } },
        {
          _id: 1,
          cumulativeEff: 1,
          'usernameData.username': 1,
        },
      )
      .lean();

    if (activeOperators.length === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No valid active operators.`,
      );
    }

    // ✅ Step 3: Compute Total Cumulative EFF
    const totalCumulativeEff = activeOperators.reduce(
      (sum, op) => sum + op.cumulativeEff,
      0,
    );

    if (totalCumulativeEff === 0) {
      this.logger.warn(
        `⚠️ (distributeCycleRewards) No valid cumulative EFF for reward distribution.`,
      );
    }

    // Track pools for reward updates
    const poolRewards = new Map<string, number>();
    const poolOperatorRewards = new Map<string, number>();

    // ✅ Step 4: Calculate rewards based on extractor status
    if (extractorOperatorId === null) {
      // No extractor operator reward, send this to reserve.
      // We will just proceed with the active operators' rewards.

      // Active operator reward share
      const activeOperatorsReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

      // ✅ Compute Each Operator's Reward Share Based on cumulative EFF
      // This includes the supposed extractor as well even if they didn't get selected due to validation issues.
      const weightedRewards = activeOperators.map((operator) => ({
        operatorId: operator._id,
        amount:
          (operator.cumulativeEff / totalCumulativeEff) * activeOperatorsReward,
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
        const soloRewardTime = performance.now();
        const extractorReward =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;
        const activeOperatorsReward =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

        // ✅ Compute Each Operator's Reward Share Based on Cumulative Eff
        const weightedRewards = activeOperators.map((operator) => ({
          operatorId: operator._id,
          amount:
            (operator.cumulativeEff / totalCumulativeEff) *
            activeOperatorsReward,
        }));

        rewardData.push(
          { operatorId: extractorOperatorId, amount: extractorReward }, // Extractor Reward
          ...weightedRewards, // Active Operators' Rewards
        );
        this.logger.debug(
          `⏱️ (distributeCycleRewards) Step 5a - Calculate SOLO rewards: ${(performance.now() - soloRewardTime).toFixed(2)}ms`,
        );

        this.logger.log(
          `✅ (distributeCycleRewards) SOLO rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH.`,
        );
      } else {
        // 🟢 **POOL OPERATOR REWARD LOGIC**
        const poolRewardTime = performance.now();
        const pool = await this.poolModel
          .findById(poolOperator.pool)
          .select('leaderId rewardSystem')
          .lean();
        if (!pool) {
          this.logger.error(
            `(distributeCycleRewards) Pool not found for extractor operator: ${extractorOperatorId}`,
          );
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

        // ✅ Step 7: Compute Rewards Based on Cumulative Eff (Only for Active Pool Operators)
        const weightedPoolOperators = activeOperators.filter((op) =>
          activePoolOperatorIds.has(op._id.toString()),
        );

        const totalPoolEff = weightedPoolOperators.reduce(
          (sum, op) => sum + op.cumulativeEff,
          0,
        );

        if (totalPoolEff === 0) {
          this.logger.warn(
            `⚠️ (distributeCycleRewards) No valid weighted EFF for pool reward distribution.`,
          );
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
            (operator.cumulativeEff / totalPoolEff) * activePoolReward;

          // Track individual pool operator rewards
          const poolOpKey = `${operator._id.toString()}_${poolOperator.pool.toString()}`;
          const existingReward = poolOperatorRewards.get(poolOpKey) || 0;
          const newReward = existingReward + opReward;

          poolOperatorRewards.set(poolOpKey, newReward);
          this.logger.debug(
            `Added pool weighted reward ${opReward.toFixed(4)} HASH to ${poolOpKey}, total: ${newReward.toFixed(4)}`,
          );

          return {
            operatorId: operator._id,
            amount: opReward,
          };
        });

        // Create an array to hold all rewards that should be added to rewardData
        const poolRewardsToAdd = [
          { operatorId: extractorOperatorId, amount: extractorReward }, // Extractor Reward
        ];

        // Only add leader reward if leaderId exists
        if (pool.leaderId) {
          poolRewardsToAdd.push({
            operatorId: pool.leaderId,
            amount: leaderReward,
          });
        }

        // Add all poolRewardsToAdd along with the weighted pool rewards
        rewardData.push(...poolRewardsToAdd, ...weightedPoolRewards);
        this.logger.debug(
          `⏱️ (distributeCycleRewards) Step 5b - Calculate POOL rewards: ${(performance.now() - poolRewardTime).toFixed(2)}ms`,
        );

        this.logger.log(
          `✅ (distributeCycleRewards) POOL rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. ${pool.leaderId ? `Leader received ${leaderReward} $HASH.` : 'No leader found, reward sent to reserve.'}`,
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

    // Count how many invalid rewards are filtered out
    let skippedRewards = 0;

    // Group rewardData by operatorId and sum the amounts
    for (const reward of rewardData) {
      // Skip null or undefined operatorId
      if (!reward.operatorId) {
        skippedRewards++;
        continue;
      }

      try {
        const operatorIdString = reward.operatorId.toString();
        const currentTotal = groupedRewardMap.get(operatorIdString) || 0;
        groupedRewardMap.set(operatorIdString, currentTotal + reward.amount);
      } catch (error) {
        this.logger.error(
          `(distributeCycleRewards) ❌ Error processing reward: ${error.message}`,
          error,
        );
        skippedRewards++;
        // Continue with other rewards
      }
    }

    if (skippedRewards > 0) {
      this.logger.warn(`⚠️ Skipped ${skippedRewards} invalid rewards`);
    }

    // Convert the grouped map to rewardShares
    for (const [operatorIdString, amount] of groupedRewardMap.entries()) {
      try {
        rewardShares.push({
          operatorId: new Types.ObjectId(operatorIdString),
          amount,
        });
      } catch (error) {
        this.logger.error(
          `❌ Error creating reward share: ${error.message}`,
          error,
        );
        // Continue with other reward shares
      }
    }

    // Step 11: Send to Hash Reserve if there are any unissued rewards
    // Loop through the reward data again and check how much HASH is sent compared to the `issuedHash`.
    // If the total is less than the issuedHash, add the difference to the reserve.
    const totalIssuedHash = rewardData.reduce(
      (sum, reward) => sum + reward.amount,
      0,
    );

    this.logger.debug(
      `(distributeCycleRewards) Total HASH rewarded to operators: ${totalIssuedHash}, issuedHash: ${issuedHash}`,
    );

    // Calculate the amount to send to the HASH Reserve
    const toSendToHashReserve = issuedHash - totalIssuedHash;

    // Check if we need to send to the HASH Reserve
    if (toSendToHashReserve > 0) {
      this.logger.debug(
        `(distributeCycleRewards) Sending ${toSendToHashReserve} $HASH to the Hash Reserve.`,
      );

      await this.hashReserveService.addToHASHReserve(toSendToHashReserve);
    }

    const endTime = performance.now();
    const totalExecutionTime = endTime - startTime;

    this.logger.debug(
      `✅ (distributeCycleRewards) Distribute cycle rewards completed in ${totalExecutionTime.toFixed(2)}ms.`,
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
      const poolBulkOps = Array.from(poolRewards.entries())
        .filter(([poolId]) => poolId != null) // Filter out null pool IDs
        .map(([poolId, amount]) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(poolId) },
            update: { $inc: { totalRewards: amount } },
          },
        }));

      // Create bulkWrite operations for pool operators
      const poolOperatorBulkOps = Array.from(poolOperatorRewards.entries())
        .filter(([key]) => key != null && key.includes('_')) // Ensure key has the expected format
        .map(([key, amount]) => {
          const parts = key.split('_');
          // Verify that we have both operatorId and poolId from the key
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            this.logger.warn(`⚠️ Invalid pool operator key format: ${key}`);
            return null;
          }

          const [operatorId, poolId] = parts;
          return {
            updateOne: {
              filter: {
                operator: new Types.ObjectId(operatorId),
                pool: new Types.ObjectId(poolId),
              },
              update: { $inc: { totalRewards: amount } },
            },
          };
        })
        .filter((op) => op !== null); // Filter out any null operations

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

    // Filter out any null or undefined operatorIds to prevent errors
    const validRewardData = rewardData.filter(
      (reward) => reward.operatorId != null,
    );

    if (validRewardData.length !== rewardData.length) {
      this.logger.warn(
        `⚠️ (batchIssueHashRewards) Filtered out ${rewardData.length - validRewardData.length} invalid rewards with null operatorIds`,
      );

      if (validRewardData.length === 0) {
        this.logger.warn(
          `⚠️ (batchIssueHashRewards) No valid rewards to process after filtering`,
        );
        return;
      }
    }

    // Process rewards in batches
    const batchPromises = [];

    // First, we need to determine which operators have active sessions
    const operatorIds = validRewardData.map((reward) => reward.operatorId);

    // Find operators with active sessions (ACTIVE or STOPPING status)
    const activeSessionsResult = await this.drillingSessionModel
      .find(
        {
          operatorId: { $in: operatorIds },
          endTime: null,
        },
        { operatorId: 1, _id: 0 },
      )
      .lean();

    // Create a Set of operator IDs with active sessions for fast lookups
    const operatorsWithActiveSessions = new Set(
      activeSessionsResult.map((session) => session.operatorId.toString()),
    );

    // For operators with active sessions, we need to update both:
    // 1. Their active session's earnedHASH (for the current session)
    // 2. Their total earned HASH (for cumulative tracking)

    // For operators without active sessions, we only update their total earned HASH

    // Prepare bulk write operations for session updates
    const sessionUpdateOps = [];
    // All operators get their totalEarnedHASH updated
    const operatorUpdateOps = [];

    for (const reward of validRewardData) {
      const operatorIdStr = reward.operatorId.toString();
      const { operatorId, amount } = reward;

      // All operators get their totalEarnedHASH updated in the operator model
      operatorUpdateOps.push({
        updateOne: {
          filter: { _id: operatorId },
          update: { $inc: { totalEarnedHASH: amount } },
        },
      });

      // If they have an active session, also update the session's earnedHASH
      if (operatorsWithActiveSessions.has(operatorIdStr)) {
        sessionUpdateOps.push({
          updateOne: {
            filter: { operatorId, endTime: null },
            update: { $inc: { earnedHASH: amount } },
          },
        });

        // Update Redis session
        batchPromises.push(
          this.drillingSessionService.updateSessionEarnedHash(
            operatorId,
            amount,
          ),
        );
      }
    }

    // Execute bulk write operations in parallel
    const bulkWritePromises = [];

    if (sessionUpdateOps.length > 0) {
      bulkWritePromises.push(
        this.drillingSessionModel.bulkWrite(sessionUpdateOps),
      );
      this.logger.log(
        `⏳ Updating ${sessionUpdateOps.length} active drilling sessions with rewards.`,
      );
    }

    if (operatorUpdateOps.length > 0) {
      bulkWritePromises.push(this.operatorModel.bulkWrite(operatorUpdateOps));
      this.logger.log(
        `⏳ Updating totalEarnedHASH for ${operatorUpdateOps.length} operators.`,
      );
    }

    // Wait for all updates to complete
    await Promise.all([...bulkWritePromises, ...batchPromises]);
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
   * Depletes fuel for active operators and replenishes for inactive ones,
   * then notifies clients and stops depleted sessions — all in bulk.
   */
  async processFuelForAllOperators(): Promise<void> {
    const t0 = performance.now();

    // 1️⃣ fetch active operators (Redis scan)
    const activeIds =
      await this.drillingSessionService.fetchActiveOperatorIds();
    const activeArray = Array.from(activeIds);

    // 2️⃣ draw your two random values once
    let fuelUsed = this.operatorService.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
    );
    let fuelGained = this.operatorService.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.maxUnits,
    );
    if (isNaN(fuelUsed)) {
      fuelUsed = GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits;
    }
    if (isNaN(fuelGained)) {
      fuelGained = GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits;
    }

    // 3️⃣ one bulkWrite: deplete actives, replenish inactives
    const ops: any[] = [];

    if (activeArray.length) {
      ops.push({
        updateMany: {
          filter: { _id: { $in: activeArray } },
          update: [
            {
              $set: {
                currentFuel: {
                  $max: [{ $subtract: ['$currentFuel', fuelUsed] }, 0],
                },
              },
            },
          ],
        },
      });
    }

    ops.push({
      updateMany: {
        filter: {
          _id: { $nin: activeArray },
          $expr: { $lt: ['$currentFuel', '$maxFuel'] },
        },
        update: [
          {
            $set: {
              currentFuel: {
                $min: [{ $add: ['$currentFuel', fuelGained] }, '$maxFuel'],
              },
            },
          },
        ],
      },
    });

    await this.operatorModel.bulkWrite(ops);

    // 4️⃣ read back: who dipped ≤ threshold & who changed at all
    const [depletedDocs, changedDocs] = await Promise.all([
      this.operatorModel
        .find(
          {
            _id: { $in: activeArray },
            currentFuel: {
              $lte: GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
            },
          },
          { _id: 1 },
        )
        .lean(),
      this.operatorModel
        .find(
          {
            $or: [
              { _id: { $in: activeArray } },
              {
                _id: { $nin: activeArray },
                $expr: { $lt: ['$currentFuel', '$maxFuel'] },
              },
            ],
          },
          { _id: 1, currentFuel: 1, maxFuel: 1 },
        )
        .lean(),
    ]);

    // 5️⃣ notify fuel updates
    const byType = changedDocs.reduce<{
      depleted: typeof changedDocs;
      replenished: typeof changedDocs;
    }>(
      (acc, doc) => {
        if (activeIds.has(doc._id)) acc.depleted.push(doc);
        else acc.replenished.push(doc);
        return acc;
      },
      { depleted: [], replenished: [] },
    );

    const depletedUpdates = byType.depleted.map((doc) => ({
      operatorId: doc._id,
      currentFuel: doc.currentFuel,
      maxFuel: doc.maxFuel,
    }));

    const replenishedUpdates = byType.replenished.map((doc) => ({
      operatorId: doc._id,
      currentFuel: doc.currentFuel,
      maxFuel: doc.maxFuel,
    }));

    this.drillingGatewayService.notifyFuelUpdates(
      depletedUpdates,
      fuelUsed,
      'depleted',
    );

    this.drillingGatewayService.notifyFuelUpdates(
      replenishedUpdates,
      fuelGained,
      'replenished',
    );

    // 6️⃣ stop depleted sessions in bulk
    const depletedIds = depletedDocs.map((d) => d._id);
    if (depletedIds.length > 0) {
      // 6a) close sessions and record HASH in two bulkWrites
      const sessionOps: any[] = [];
      const hashOps: any[] = [];
      const now = new Date();

      // fetch all raw session payloads in one mget
      const keys = depletedIds.map((id) =>
        this.drillingSessionService.getSessionKey(id.toString()),
      );
      const raws = await this.redisService.mget(keys);

      for (let i = 0; i < depletedIds.length; i++) {
        const id = depletedIds[i];
        const session = JSON.parse(raws[i] || '{}') as any;

        sessionOps.push({
          updateOne: {
            filter: { operatorId: id, endTime: null },
            update: { endTime: now, earnedHASH: session.earnedHASH },
          },
        });
        hashOps.push({
          updateOne: {
            filter: { _id: id },
            update: { $inc: { totalEarnedHASH: session.earnedHASH } },
          },
        });
      }

      await Promise.all([
        this.drillingSessionModel.bulkWrite(sessionOps),
        this.operatorModel.bulkWrite(hashOps),
        // 6b) one Redis pipeline: del keys + decrement counters
        this.redisService.pipeline((cmds) => {
          keys.forEach((k) => cmds.del(k));
          cmds.decrby('drilling:activeSessionsCount', depletedIds.length);
          return cmds.exec();
        }),
      ]);

      // 6c) broadcast stop-drilling events in one shot
      await this.drillingGateway.broadcastStopDrilling(depletedIds, {
        message: 'Drilling stopped due to insufficient fuel',
        reason: 'fuel_depleted',
      });

      // 6d) update in-memory & broadcast counts
      await this.drillingGateway.saveActiveDrillingOperatorsToRedis();
      this.drillingGateway.broadcastOnlineOperators();
    }

    this.logger.log(
      `⚡ processFuelForAllOperators done in ${(performance.now() - t0).toFixed(2)}ms`,
    );
  }

  // /**
  //  * Depletes fuel for active operators (i.e. operators that have an active drilling session)
  //  * and replenishes fuel for inactive operators (i.e. operators that do not have an active drilling session).
  //  */
  // async processFuelForAllOperators(currentCycleNumber: number): Promise<void> {
  //   const startTime = performance.now();

  //   try {
  //     // Fetch active operator IDs
  //     const fetchOperatorsTime = performance.now();
  //     const activeOperatorIds =
  //       await this.drillingSessionService.fetchActiveOperatorIds();
  //     this.logger.debug(
  //       `⏱️ (processFuelForAllOperators) Step 1 - Fetch active operators: ${(performance.now() - fetchOperatorsTime).toFixed(2)}ms`,
  //     );

  //     // Generate random fuel values based on game constants
  //     const genFuelValuesTime = performance.now();
  //     let fuelUsed = this.operatorService.getRandomFuelValue(
  //       GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.minUnits,
  //       GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
  //     );

  //     let fuelGained = this.operatorService.getRandomFuelValue(
  //       GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits,
  //       GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.maxUnits,
  //     );

  //     // Validate fuel values to prevent NaN issues
  //     if (isNaN(fuelUsed) || isNaN(fuelGained)) {
  //       // Set them to fixed values
  //       fuelUsed = 600;
  //       fuelGained = 10;
  //     }
  //     this.logger.debug(
  //       `⏱️ (processFuelForAllOperators) Step 2 - Generate fuel values: ${(performance.now() - genFuelValuesTime).toFixed(2)}ms`,
  //     );

  //     this.logger.log(
  //       `Processing fuel: depleting ${fuelUsed} from active operators, replenishing ${fuelGained} to inactive operators`,
  //     );

  //     // Process fuel updates in parallel - only operators that need notifications are returned
  //     const processFuelUpdatesTime = performance.now();
  //     let depletedOperators = [],
  //       replenishedOperators = [],
  //       depletedOperatorIds = [];
  //     try {
  //       [depletedOperators, replenishedOperators, depletedOperatorIds] =
  //         await Promise.all([
  //           // Deplete fuel for active operators - returns all updated operators
  //           this.operatorService.depleteFuel(activeOperatorIds, fuelUsed),

  //           // Replenish fuel for inactive operators - returns all updated operators
  //           this.operatorService.replenishFuel(activeOperatorIds, fuelGained),

  //           // Find operators whose fuel dropped below threshold
  //           this.operatorService.fetchDepletedOperatorIds(activeOperatorIds),
  //         ]);
  //     } catch (fuelProcessingError) {
  //       this.logger.error(
  //         `Failed to process fuel operations: ${fuelProcessingError.message}`,
  //         fuelProcessingError.stack,
  //       );
  //       // Continue execution with empty arrays to avoid breaking the cycle
  //       depletedOperators = [];
  //       replenishedOperators = [];
  //       depletedOperatorIds = [];
  //     }
  //     this.logger.debug(
  //       `⏱️ (processFuelForAllOperators) Step 3 - Process fuel updates: ${(performance.now() - processFuelUpdatesTime).toFixed(2)}ms`,
  //     );

  //     // Notify operators about fuel updates - send to all operators for real-time updates
  //     const notifyOperatorsTime = performance.now();
  //     try {
  //       await Promise.all([
  //         // Notify active operators about fuel depletion
  //         this.drillingGatewayService.notifyFuelUpdates(
  //           depletedOperators,
  //           fuelUsed,
  //           'depleted',
  //         ),

  //         // Notify inactive operators about fuel replenishment
  //         this.drillingGatewayService.notifyFuelUpdates(
  //           replenishedOperators,
  //           fuelGained,
  //           'replenished',
  //         ),
  //       ]);
  //     } catch (notificationError) {
  //       this.logger.error(
  //         `Failed to send fuel notifications: ${notificationError.message}`,
  //         notificationError.stack,
  //       );
  //       // Continue execution as notifications are not critical
  //     }
  //     this.logger.debug(
  //       `⏱️ (processFuelForAllOperators) Step 4 - Notify fuel updates: ${(performance.now() - notifyOperatorsTime).toFixed(2)}ms`,
  //     );

  //     // Handle depleted operators
  //     const handleDepletedTime = performance.now();
  //     if (depletedOperatorIds.length > 0) {
  //       try {
  //         await Promise.all([
  //           // Stop drilling sessions for depleted operators
  //           this.drillingSessionService.stopDrillingForDepletedOperators(
  //             depletedOperatorIds,
  //             currentCycleNumber,
  //           ),

  //           // Broadcast stop drilling event to depleted operators
  //           this.drillingGateway.broadcastStopDrilling(depletedOperatorIds, {
  //             message: 'Drilling stopped due to insufficient fuel',
  //             reason: 'fuel_depleted',
  //           }),
  //         ]);
  //       } catch (stopDrillingError) {
  //         this.logger.error(
  //           `Failed to stop drilling for depleted operators: ${stopDrillingError.message}`,
  //           stopDrillingError.stack,
  //         );
  //       }
  //     }
  //     this.logger.debug(
  //       `⏱️ (processFuelForAllOperators) Step 5 - Handle depleted operators: ${(performance.now() - handleDepletedTime).toFixed(2)}ms`,
  //     );

  //     const endTime = performance.now();
  //     const executionTime = (endTime - startTime).toFixed(2);

  //     this.logger.log(
  //       `⚡ Fuel Processing Completed:
  //        ⛏ Depleted ${fuelUsed} fuel for ${activeOperatorIds.size} active operators.
  //        🔋 Replenished ${fuelGained} fuel for inactive operators.
  //        🛑 Stopped drilling for ${depletedOperatorIds.length} operators below fuel threshold.
  //        📢 Sent fuel update notifications to ${depletedOperators.length + replenishedOperators.length} operators.
  //        ⏱ Execution Time: ${executionTime}ms
  //        ⏱ Performance breakdown:
  //          - Fetch active operators: ${(fetchOperatorsTime - startTime).toFixed(2)}ms
  //          - Generate fuel values: ${(genFuelValuesTime - fetchOperatorsTime).toFixed(2)}ms
  //          - Process fuel updates: ${(processFuelUpdatesTime - genFuelValuesTime).toFixed(2)}ms
  //          - Notify operators: ${(notifyOperatorsTime - processFuelUpdatesTime).toFixed(2)}ms
  //          - Handle depleted operators: ${(handleDepletedTime - notifyOperatorsTime).toFixed(2)}ms`,
  //     );
  //   } catch (error) {
  //     this.logger.error(
  //       `❌ Error processing fuel: ${error.message}`,
  //       error.stack,
  //     );
  //     // The error is caught here to prevent the whole cycle process from failing
  //     // We log it but don't rethrow so the rest of the cycle operations can continue
  //   }
}
