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
import { Operator } from 'src/operators/schemas/operator.schema';
import { Drill } from './schemas/drill.schema';
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';
import { Pool } from 'src/pools/schemas/pool.schema';
import { OperatorService } from 'src/operators/operator.service';
import { DrillService } from './drill.service';

@Injectable()
export class DrillingCycleService {
  private readonly logger = new Logger(DrillingCycleService.name);
  private readonly redisCycleKey = 'drilling-cycle:current';
  private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000; // Convert to ms

  constructor(
    @InjectModel(DrillingCycle.name)
    private drillingCycleModel: Model<DrillingCycle>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    @InjectModel(Pool.name) private poolModel: Model<Pool>,
    private readonly redisService: RedisService,
    private readonly drillingSessionService: DrillingSessionService,
    private readonly drillService: DrillService,
    private readonly operatorService: OperatorService,
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

    this.logger.log(`🛠 Creating Drilling Cycle: #${newCycleNumber}...`);

    try {
      // Measure execution time for fetching active drilling sessions
      const startFetchTime = performance.now();
      const activeOperators =
        await this.drillingSessionService.fetchActiveDrillingSessions();
      const endFetchTime = performance.now();
      const fetchTime = (endFetchTime - startFetchTime).toFixed(2); // Convert to milliseconds

      this.logger.log(`⏳ Fetching active sessions took ${fetchTime}ms.`);

      // Create the drilling cycle with active operator count
      const cycle = await this.drillingCycleModel.create({
        cycleNumber: newCycleNumber,
        startTime: now,
        endTime: new Date(now.getTime() + this.cycleDuration),
        activeOperators, // Track active operators
        extractorId: null,
        difficulty: 0,
        issuedHASH: GAME_CONSTANTS.HASH_ISSUANCE.CYCLE_HASH_ISSUANCE,
      });

      this.logger.log(
        `✅ New Drilling Cycle Created: #${cycle.cycleNumber} with ${activeOperators} active operators.`,
      );
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
    await this.operatorService.processFuelForAllOperators();

    // ✅ Step 4: Update the cycle with extractor ID
    if (extractorData) {
      await this.drillingCycleModel.updateOne(
        { cycleNumber },
        { extractorId: extractorData.drillId },
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
    // cycleId: Types.ObjectId,
    extractorId: Types.ObjectId,
    issuedHash: number,
  ) {
    // Measure execution time
    const now = performance.now();

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

    // Fetch all active operators in one go
    const allActiveOperatorIds =
      await this.drillingSessionService.fetchActiveDrillingSessionOperatorIds();

    // Check if extractor operator is in a pool
    const poolOperator = await this.poolOperatorModel
      .findOne({ operatorId: extractorOperatorId })
      .select('poolId')
      .lean();

    if (!poolOperator) {
      // SOLO OPERATOR REWARD LOGIC
      const extractorReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator;
      const activeOperatorsReward =
        issuedHash *
        GAME_CONSTANTS.REWARDS.SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators;

      // Prepare batch update for rewards
      const rewardData = [
        { operatorId: extractorOperatorId, amount: extractorReward },
        ...allActiveOperatorIds
          .filter((id) => id.toString() !== extractorOperatorId.toString()) // Exclude extractor
          .map((operatorId) => ({
            operatorId,
            amount: activeOperatorsReward / (allActiveOperatorIds.length - 1), // Divide reward
          })),
      ];

      const end = performance.now();

      this.logger.log(
        `⏳ (Performance) Reward calculation for solo operator took ${end - now}ms.`,
      );

      // Batch issue rewards
      await this.batchIssueHashRewards(rewardData);

      this.logger.log(
        `✅ (distributeCycleRewards) SOLO rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. Active operators split ${activeOperatorsReward} $HASH.`,
      );

      return;
    }

    // 🟢 POOL OPERATOR REWARD LOGIC
    const pool = await this.poolModel
      .findById(poolOperator.poolId)
      .select('leaderId rewardSystem')
      .lean();

    if (!pool) {
      this.logger.error(
        `(distributeCycleRewards) Pool not found for operator: ${extractorOperatorId}`,
      );
      return;
    }

    // Get active pool operator IDs
    // Get all matching pool operators in one query
    const activePoolOperators = await this.poolOperatorModel
      .find(
        {
          poolId: poolOperator.poolId,
          operatorId: { $in: allActiveOperatorIds },
        },
        { operatorId: 1 }, // Only fetch operatorId for efficiency
      )
      .lean();

    // Convert to a Set for fast lookups
    const activePoolOperatorIds = new Set(
      activePoolOperators.map((op) => op.operatorId),
    );

    // Split rewards
    const extractorReward = issuedHash * pool.rewardSystem.extractorOperator;
    const leaderReward = issuedHash * pool.rewardSystem.leader;
    const activePoolReward = issuedHash * pool.rewardSystem.activePoolOperators;

    // Prepare batch update for rewards
    const rewardData = [
      { operatorId: extractorOperatorId, amount: extractorReward },
      { operatorId: pool.leaderId, amount: leaderReward },
      ...Array.from(activePoolOperatorIds).map((operatorId) => ({
        operatorId,
        amount: activePoolReward / activePoolOperatorIds.size,
      })),
    ];

    const end = performance.now();

    this.logger.log(
      `⏳ (Performance) Reward calculation for pooled operator took ${end - now}ms.`,
    );

    // Batch issue rewards
    await this.batchIssueHashRewards(rewardData);

    this.logger.log(
      `✅ (distributeCycleRewards) POOL rewards issued. Extractor ${extractorOperatorId} received ${extractorReward} $HASH. Leader received ${leaderReward} $HASH. Active pool operators split ${activePoolReward} $HASH.`,
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

    await this.operatorModel.bulkWrite(
      rewardData.map(({ operatorId, amount }) => ({
        updateOne: {
          filter: { _id: operatorId },
          update: { $inc: { balance: amount } },
        },
      })),
    );

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
}
