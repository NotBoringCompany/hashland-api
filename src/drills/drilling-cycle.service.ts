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
   *
   * Optimized version that reduces sequential database operations.
   */
  async endCurrentCycle(cycleNumber: number) {
    const startTime = performance.now();
    this.logger.log(`⏳ (endCurrentCycle) Ending cycle #${cycleNumber}...`);

    try {
      // ✅ Step 1: Fetch issued HASH from Redis
      // We do this as the first operation but don't wait for it yet
      const issuedHASHPromise = this.redisService.get(
        `drilling-cycle:${cycleNumber}:issuedHASH`,
      );

      // ✅ Step 2: Select extractor - run this immediately
      const extractorDataPromise = this.drillService.selectExtractor();

      // Wait for the issued HASH value as we need it for further calculations
      const issuedHASHStr = await issuedHASHPromise;
      const issuedHASH = issuedHASHStr ? parseFloat(issuedHASHStr) : 0;

      // Get extractor data
      const extractorData = await extractorDataPromise;
      let finalExtractorOperatorId: Types.ObjectId | null = null;
      const totalWeightedEff = extractorData?.totalWeightedEff || 0;

      // If we have extractor data, verify eligibility
      if (extractorData) {
        const extractorOperatorId = extractorData.drillOperatorId;

        // ✅ Step 2B: Fetch operator's data and wallets in parallel
        // We avoid sequential queries by running them simultaneously
        const [extractorOperator, extractorOperatorWallets] = await Promise.all(
          [
            this.operatorService.findById(extractorOperatorId, {
              assetEquity: 1,
              username: 1,
            }),
            this.operatorWalletService.getOperatorWallets(extractorOperatorId, {
              address: 1,
              chain: 1,
            }),
          ],
        );

        if (extractorOperator) {
          const storedAssetEquity = extractorOperator.assetEquity;
          const minThreshold =
            GAME_CONSTANTS.EXTRACTOR.OPERATOR_MINIMUM_ASSET_EQUITY_THRESHOLD *
            storedAssetEquity;

          // Only check balances if the operator has wallets
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

          // Set final extractor id if eligible
          if (currentEquity >= minThreshold) {
            finalExtractorOperatorId = extractorData.drillOperatorId;
          } else {
            this.logger.warn(
              `(endCurrentCycle) Extractor operator ${extractorOperatorId} has dropped below the asset equity threshold. Skipping extractor for this cycle.`,
            );
          }
        } else {
          this.logger.warn(
            `(endCurrentCycle) Extractor operator ${extractorOperatorId} not found. Skipping extractor.`,
          );
        }
      } else {
        this.logger.warn(
          `(endCurrentCycle) No valid extractor drill found. Skipping extractor distribution.`,
        );
      }

      // ✅ Steps 3-6: Run these operations in parallel where possible
      // Start multiple operations concurrently to reduce total execution time
      const [
        rewardShares, // Step 3: Distribute rewards
        // Step 4: Process fuel (void return) - no need to capture the result
      ] = await Promise.all([
        // ✅ Step 3: Distribute rewards to operators
        this.distributeCycleRewards(finalExtractorOperatorId, issuedHASH),

        // ✅ Step 4: Process Fuel for ALL Operators (returns void)
        this.processFuelForAllOperators(cycleNumber),
      ]);

      // ✅ Step 5: Update the cycle and create reward shares
      // Create cycle update and reward shares operations
      const rewardShareDocs = rewardShares.map((reward) => ({
        cycleNumber,
        operatorId: reward.operatorId,
        amount: reward.amount,
      }));

      // Run these operations in parallel since they don't depend on each other
      const [latestCycle] = await Promise.all([
        // Update cycle with extractor info
        this.drillingCycleModel.findOneAndUpdate(
          { cycleNumber },
          {
            extractorId: extractorData?.drillId || null,
            extractorOperatorId: finalExtractorOperatorId,
            totalWeightedEff,
          },
          { new: true },
        ),

        // Insert reward shares to database
        this.drillingCycleRewardShareModel.insertMany(rewardShareDocs),
      ]);

      // Check if we found the cycle
      if (!latestCycle) {
        throw new Error(
          `Failed to update cycle #${cycleNumber} - document not found in MongoDB`,
        );
      }

      // ✅ Step 6: Complete stopping sessions and send notifications
      // Run these operations in parallel
      const [completionResult] = await Promise.all([
        // Complete any stopping sessions
        this.drillingSessionService.completeStoppingSessionsForEndCycle(
          cycleNumber,
        ),

        // Send WebSocket notification about the latest cycle
        this.drillingGateway.storeLatestCycleInRedis(latestCycle),
      ]);

      // Send notifications asynchronously (don't wait for them)
      // Notify operators about session completion - don't block cycle completion
      if (completionResult.operatorIds.length > 0) {
        this.drillingGatewayService
          .notifySessionsCompleted(
            completionResult.operatorIds,
            cycleNumber,
            completionResult.earnedHASH,
          )
          .catch((error) => {
            this.logger.error(
              `Error sending session completion notifications: ${error.message}`,
            );
          });
      }

      // Send WebSocket notification with reward shares
      this.drillingGatewayService
        .notifyNewCycle(latestCycle, rewardShares)
        .catch((error) => {
          this.logger.error(
            `Error sending new cycle notifications: ${error.message}`,
          );
        });

      const endTime = performance.now();
      this.logger.log(
        `✅ (endCurrentCycle) Cycle #${cycleNumber} processing completed in ${(endTime - startTime).toFixed(2)}ms.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ (endCurrentCycle) Error during cycle #${cycleNumber} processing: ${error.message}`,
        error.stack,
      );
      // We don't rethrow to avoid crashing the app
    }
  }

  /**
   * Distributes $HASH rewards to operators at the end of a drilling cycle.
   * Optimized version that reduces database operations and improves performance.
   */
  async distributeCycleRewards(
    extractorOperatorId: Types.ObjectId | null, // ✅ Extractor operator ID can be null
    issuedHash: number,
  ): Promise<{ operatorId: Types.ObjectId; amount: number }[]> {
    const now = performance.now();
    const rewardData: { operatorId: Types.ObjectId; amount: number }[] = [];
    const rewardShares: { operatorId: Types.ObjectId; amount: number }[] = [];
    let toSendToHashReserve = 0;

    try {
      // ✅ Step 1 & 2: Fetch All Active Operators' Data in a single aggregation
      // This replaces two separate database calls with one optimized query
      const activeOperatorsResult = await this.drillingSessionModel
        .aggregate([
          // Filter for active sessions
          { $match: { endTime: null } },
          // Lookup operator data
          {
            $lookup: {
              from: 'operators',
              localField: 'operatorId',
              foreignField: '_id',
              as: 'operator',
            },
          },
          // Unwind the operator array
          { $unwind: '$operator' },
          // Group to remove duplicates
          {
            $group: {
              _id: '$operator._id',
              cumulativeEff: { $first: '$operator.cumulativeEff' },
              effMultiplier: { $first: '$operator.effMultiplier' },
              username: { $first: '$operator.username' },
            },
          },
          // Project needed fields
          {
            $project: {
              _id: 1,
              cumulativeEff: 1,
              effMultiplier: 1,
              username: 1,
            },
          },
        ])
        .exec();

      if (activeOperatorsResult.length === 0) {
        this.logger.warn(
          `⚠️ (distributeCycleRewards) No active operators found for reward distribution.`,
        );
        return rewardShares; // Return early if no operators
      }

      // Transform the results for easier processing
      const activeOperators = activeOperatorsResult.map((op) => ({
        _id: op._id,
        cumulativeEff: op.cumulativeEff || 0,
        effMultiplier: op.effMultiplier || 1,
        username: op.username,
      }));

      // Create a set of all active operator IDs for faster lookups
      const allActiveOperatorIds = activeOperators.map((op) => op._id);

      // ✅ Step 3: Apply Luck Factor & Compute Weighted Eff (no DB changes needed)
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
        return rewardShares; // Return early if no valid weighted EFF
      }

      // Track pools for reward updates - use Maps for O(1) lookups
      const poolRewards = new Map<string, number>();
      const poolOperatorRewards = new Map<string, number>();

      if (extractorOperatorId === null) {
        // 🟡 No Extractor Selected - Handle No-Extractor Case
        const extractorHashAllocation =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;

        // Add the extractor's $HASH allocation to the reserve
        toSendToHashReserve += extractorHashAllocation;

        // Active operator reward share
        const activeOperatorsReward =
          issuedHash *
          GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

        // Compute rewards efficiently with a single pass
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
        // ✅ Step 5: Check If Extractor is in a Pool - combine with other lookups
        // Fetch pool information in a single query if the extractor is selected
        const poolOperatorData = await this.poolOperatorModel
          .findOne({ operator: extractorOperatorId })
          .select('pool')
          .populate({
            path: 'pool',
            select: 'leaderId rewardSystem',
          })
          .lean();

        const isSoloOperator = !poolOperatorData;

        if (isSoloOperator) {
          // 🟢 SOLO OPERATOR REWARD LOGIC - More efficient processing
          const extractorReward =
            issuedHash *
            GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM
              .extractorOperator;
          const activeOperatorsReward =
            issuedHash *
            GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM
              .allActiveOperators;

          // Pre-calculate rewards in a single pass
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
          // 🟢 POOL OPERATOR REWARD LOGIC - More efficient processing
          // Properly type the pool object to avoid type errors
          const pool = poolOperatorData?.pool as any;
          if (!pool) {
            this.logger.error(
              `(distributeCycleRewards) Pool not found for extractor operator: ${extractorOperatorId}`,
            );
            // Continue with default behavior for this case
            return rewardShares;
          }

          // Get active pool operators in a single efficient query
          const activePoolOperators = await this.poolOperatorModel
            .aggregate([
              {
                $match: {
                  pool: pool._id,
                  operator: { $in: allActiveOperatorIds },
                },
              },
              {
                $project: {
                  operator: 1,
                  _id: 0,
                },
              },
            ])
            .exec();

          // Create a Set for faster lookups
          const activePoolOperatorIds = new Set(
            activePoolOperators.map((op) => op.operator.toString()),
          );

          // Filter weighted operators by pool membership in a single pass
          const weightedPoolOperators = operatorsWithLuck.filter((op) =>
            activePoolOperatorIds.has(op.operatorId.toString()),
          );

          // Calculate pool efficiency sum
          const totalPoolEff = weightedPoolOperators.reduce(
            (sum, op) => sum + op.weightedEff,
            0,
          );

          if (totalPoolEff === 0) {
            this.logger.warn(
              `⚠️ (distributeCycleRewards) No valid weighted EFF for pool reward distribution.`,
            );
            // In this case, we should still process the extractor and leader rewards
          }

          // Calculate all rewards at once
          const extractorReward =
            issuedHash * pool.rewardSystem.extractorOperator;
          const leaderReward = issuedHash * pool.rewardSystem.leader;
          const activePoolReward =
            issuedHash * pool.rewardSystem.activePoolOperators;
          const totalPoolReward =
            extractorReward + leaderReward + activePoolReward;

          // Set pool rewards - combine operations
          poolRewards.set(pool._id.toString(), totalPoolReward);

          // Check if extractor is in pool in O(1) time
          if (activePoolOperatorIds.has(extractorOperatorId.toString())) {
            const poolOpKey = `${extractorOperatorId.toString()}_${pool._id.toString()}`;
            poolOperatorRewards.set(poolOpKey, extractorReward);
          }

          // Handle leader rewards - combine conditionals
          if (!pool.leaderId) {
            // If no leader, send to reserve
            toSendToHashReserve += leaderReward;
          } else if (activePoolOperatorIds.has(pool.leaderId.toString())) {
            // If leader is active, add reward
            const poolOpKey = `${pool.leaderId.toString()}_${pool._id.toString()}`;
            const existingReward = poolOperatorRewards.get(poolOpKey) || 0;
            poolOperatorRewards.set(poolOpKey, existingReward + leaderReward);
          }

          // Calculate all weighted pool rewards in a single pass
          const weightedPoolRewards = weightedPoolOperators.map((operator) => {
            const opReward =
              totalPoolEff > 0
                ? (operator.weightedEff / totalPoolEff) * activePoolReward
                : 0; // Prevent division by zero

            const poolOpKey = `${operator.operatorId.toString()}_${pool._id.toString()}`;

            // Update the poolOperatorRewards map
            const existingReward = poolOperatorRewards.get(poolOpKey) || 0;
            poolOperatorRewards.set(poolOpKey, existingReward + opReward);

            return {
              operatorId: operator.operatorId,
              amount: opReward,
            };
          });

          // Create reward data more efficiently
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

          // Add all rewards to rewardData in a single operation
          rewardData.push(...poolRewardsToAdd, ...weightedPoolRewards);

          this.logger.log(
            `✅ (distributeCycleRewards) POOL rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. ${pool.leaderId ? `Leader received ${leaderReward} $HASH.` : 'No leader found, reward sent to reserve.'}`,
          );
        }
      }

      // ✅ Step 8: Batch Issue Rewards - Already optimized in the previous update
      await this.batchIssueHashRewards(rewardData);

      // ✅ Step 9: Update pool rewards in parallel with other operations
      if (poolRewards.size > 0 || poolOperatorRewards.size > 0) {
        await this.updatePoolAndOperatorRewards(
          poolRewards,
          poolOperatorRewards,
        );
      }

      // ✅ Step 10: Process reward shares more efficiently
      // Create an efficient operator ID to amount map
      const groupedRewardMap = new Map<string, number>();

      // Combine all rewards for each operator in a single pass
      for (const reward of rewardData) {
        if (!reward.operatorId) continue;

        try {
          const opIdStr = reward.operatorId.toString();
          const currentAmount = groupedRewardMap.get(opIdStr) || 0;
          groupedRewardMap.set(opIdStr, currentAmount + reward.amount);
        } catch (error) {
          this.logger.error(`❌ Error processing reward: ${error.message}`);
          // Continue with other rewards
        }
      }

      // Convert grouped rewards to the final format in a single operation
      rewardShares.push(
        ...Array.from(groupedRewardMap.entries())
          .map(([opIdStr, amount]) => ({
            operatorId: new Types.ObjectId(opIdStr),
            amount,
          }))
          .filter((reward) => reward.amount > 0),
      );

      // ✅ Step 11: Send to Hash Reserve asynchronously
      if (toSendToHashReserve > 0) {
        this.hashReserveService
          .addToHASHReserve(toSendToHashReserve)
          .catch((error) => {
            this.logger.error(
              `❌ Error adding to HASH reserve: ${error.message}`,
              error.stack,
            );
          });
      }

      const end = performance.now();
      this.logger.log(
        `✅ (distributeCycleRewards) Rewards distributed in ${(end - now).toFixed(2)}ms.`,
      );

      return rewardShares;
    } catch (error) {
      this.logger.error(
        `❌ Error distributing cycle rewards: ${error.message}`,
        error.stack,
      );
      // Return empty array to prevent cycle from failing
      return [];
    }
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
   * Optimized version that reduces database operations through aggregation.
   */
  async batchIssueHashRewards(
    rewardData: { operatorId: Types.ObjectId; amount: number }[],
  ) {
    if (!rewardData.length) return;

    // Measure execution time
    const start = performance.now();

    // Filter out any null or undefined operatorIds to prevent errors
    const validRewardData = rewardData.filter(
      (reward) => reward.operatorId != null && reward.amount > 0,
    );

    if (validRewardData.length !== rewardData.length) {
      this.logger.warn(
        `⚠️ (batchIssueHashRewards) Filtered out ${rewardData.length - validRewardData.length} invalid rewards`,
      );

      if (validRewardData.length === 0) {
        this.logger.warn(
          `⚠️ (batchIssueHashRewards) No valid rewards to process after filtering`,
        );
        return;
      }
    }

    // Prepare operator IDs array for efficient lookup
    const operatorIds = validRewardData.map((reward) => reward.operatorId);

    // Create a lookup Map for reward amounts to avoid iterating multiple times
    const operatorRewardMap = new Map<string, number>();
    for (const reward of validRewardData) {
      const opIdStr = reward.operatorId.toString();
      const currentAmount = operatorRewardMap.get(opIdStr) || 0;
      operatorRewardMap.set(opIdStr, currentAmount + reward.amount);
    }

    try {
      // Use aggregation to efficiently categorize operators in a single query
      // This replaces the separate queries for active vs passive operators
      const categorizedOperators = await this.drillingSessionModel
        .aggregate([
          {
            $match: {
              operatorId: { $in: operatorIds },
              endTime: null,
            },
          },
          {
            $group: {
              _id: null,
              activeOperatorIds: { $push: '$operatorId' },
            },
          },
          {
            $project: {
              _id: 0,
              activeOperatorIds: 1,
            },
          },
        ])
        .exec();

      // Extract active operator IDs from aggregation result
      const activeOperatorIdSet = new Set<string>();
      if (
        categorizedOperators.length > 0 &&
        categorizedOperators[0].activeOperatorIds
      ) {
        categorizedOperators[0].activeOperatorIds.forEach(
          (id: Types.ObjectId) => activeOperatorIdSet.add(id.toString()),
        );
      }

      // Prepare bulk operations for active and passive operators
      const sessionBulkOps = [];
      const operatorBulkOps = [];
      const redisUpdatePromises = [];

      // Process each reward and prepare appropriate updates
      for (const reward of validRewardData) {
        const operatorIdStr = reward.operatorId.toString();
        const amount = operatorRewardMap.get(operatorIdStr) || reward.amount;

        if (activeOperatorIdSet.has(operatorIdStr)) {
          // Active operator - update session
          sessionBulkOps.push({
            updateOne: {
              filter: { operatorId: reward.operatorId, endTime: null },
              update: { $inc: { earnedHASH: amount } },
            },
          });

          // Also update Redis (optimized to use consolidated amount)
          redisUpdatePromises.push(
            this.drillingSessionService.updateSessionEarnedHash(
              reward.operatorId,
              amount,
            ),
          );
        } else {
          // Passive operator - update totalEarnedHASH directly
          operatorBulkOps.push({
            updateOne: {
              filter: { _id: reward.operatorId },
              update: { $inc: { totalEarnedHASH: amount } },
            },
          });
        }
      }

      // Execute all database updates in parallel for maximum efficiency
      const updatePromises = [];

      if (sessionBulkOps.length > 0) {
        updatePromises.push(
          this.drillingSessionModel.bulkWrite(sessionBulkOps),
        );
      }

      if (operatorBulkOps.length > 0) {
        updatePromises.push(this.operatorModel.bulkWrite(operatorBulkOps));
      }

      // Execute all operations in parallel
      await Promise.all([
        ...updatePromises,
        // Only wait for Redis updates if there are any
        ...(redisUpdatePromises.length > 0
          ? [Promise.all(redisUpdatePromises)]
          : []),
      ]);

      const end = performance.now();
      const activeOperatorCount = activeOperatorIdSet.size;
      const passiveOperatorCount = validRewardData.length - activeOperatorCount;

      this.logger.log(
        `✅ (batchIssueHashRewards) Issued ${validRewardData.length} rewards in ${(
          end - start
        ).toFixed(
          2,
        )}ms. (${activeOperatorCount} active, ${passiveOperatorCount} passive).`,
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
