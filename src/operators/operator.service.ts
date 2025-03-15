import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Operator } from './schemas/operator.schema';
import { PoolOperatorService } from 'src/pools/pool-operator.service';
import { PoolService } from 'src/pools/pool.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Drill } from 'src/drills/schemas/drill.schema';
import { DrillService } from 'src/drills/drill.service';
import { RedisService } from 'src/common/redis.service';
import { OperatorWallet } from './schemas/operator-wallet.schema';
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';
import { ApiResponse } from 'src/common/dto/response.dto';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
    private readonly poolOperatorService: PoolOperatorService,
    private readonly poolService: PoolService,
    private readonly drillService: DrillService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Fetches an operator's data. Includes their base data, their wallet instances, their drills and also their pool ID if in a pool.
   *
   * Optional projection for operator data fields.
   */
  async fetchOperatorData(
    operatorId: Types.ObjectId,
    operatorDataProjection?: Record<string, number>,
  ): Promise<
    ApiResponse<{
      operator: Operator;
      wallets: OperatorWallet[];
      drills: Drill[];
      poolId?: Types.ObjectId;
    }>
  > {
    try {
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, operatorDataProjection)
        .lean();

      if (!operator) {
        throw new NotFoundException('(fetchOperatorData) Operator not found');
      }

      // Fetch operator's wallets
      const wallets = await this.operatorWalletModel
        .find(
          { operatorId },
          {
            _id: 0,
            address: 1,
            chain: 1,
          },
        )
        .lean();

      // Fetch operator's drills
      const drills = await this.drillModel
        .find({ operatorId }, { _id: 0 })
        .lean();

      // Fetch operator's pool ID if in a pool
      const poolId = await this.poolOperatorModel
        .findOne({ operatorId }, { poolId: 1 })
        .lean();

      return new ApiResponse<{
        operator: Operator;
        wallets: OperatorWallet[];
        drills: Drill[];
        poolId?: Types.ObjectId;
      }>(200, `(fetchOperatorData) Operator data fetched successfully`, {
        operator,
        wallets,
        drills,
        poolId: poolId?.poolId,
      });
    } catch (err: any) {
      throw new Error(
        `(fetchOperatorData) Error fetching operator data: ${err.message}`,
      );
    }
  }

  /**
   * Updates cumulativeEff for all operators by summing their drills' actualEff values.
   *
   * This is called periodically to keep the cumulativeEff values up-to-date.
   */
  async updateCumulativeEff() {
    this.logger.log(
      '🔄 (updateCumulativeEff) Updating cumulativeEff for all operators...',
    );
    const startTime = performance.now();

    // ✅ Step 1: Aggregate Total `actualEff` per Operator
    const operatorEffData = await this.drillModel.aggregate([
      {
        $group: {
          _id: '$operatorId',
          totalEff: { $sum: '$actualEff' },
        },
      },
    ]);

    if (operatorEffData.length === 0) {
      this.logger.warn(
        '⚠️ (updateCumulativeEff) No drills found. Skipping update.',
      );
      return;
    }

    // ✅ Step 2: Prepare Bulk Updates
    const bulkUpdates = operatorEffData.map(({ _id, totalEff }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { cumulativeEff: totalEff } },
      },
    }));

    // ✅ Step 3: Batch Process Updates for Large Datasets
    const batchSize = 1000;
    for (let i = 0; i < bulkUpdates.length; i += batchSize) {
      await this.operatorModel.bulkWrite(bulkUpdates.slice(i, i + batchSize));
      this.logger.log(
        `✅ (updateCumulativeEff) Processed batch ${i / batchSize + 1}/${Math.ceil(bulkUpdates.length / batchSize)}`,
      );
    }

    const endTime = performance.now();
    this.logger.log(
      `✅ (updateCumulativeEff) Updated cumulativeEff for ${operatorEffData.length} operators in ${(endTime - startTime).toFixed(2)}ms.`,
    );
  }

  /**
   * Increments an operator's `totalHASHEarned` field by a given amount.
   *
   * This is usually called after ending a drilling session.
   */
  async incrementTotalHASHEarned(operatorId: Types.ObjectId, amount: number) {
    try {
      await this.operatorModel.updateOne(
        { _id: operatorId },
        { $inc: { totalHASHEarned: amount } },
      );
    } catch (err: any) {
      throw new Error(
        `(incrementTotalHASHEarned) Error incrementing total HASH earned: ${err.message}`,
      );
    }
  }

  /**
   * Checks if an operator has enough fuel to start/continue drilling.
   * First checks Redis cache, then falls back to database if needed.
   */
  async hasEnoughFuel(operatorId: Types.ObjectId): Promise<boolean> {
    try {
      // Try to get cached fuel values first for better performance
      const cachedFuel = await this.getCachedFuelValues(operatorId);

      if (cachedFuel) {
        // Use cached value if available
        return (
          cachedFuel.currentFuel >=
          GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits
        );
      }

      // Fall back to database if not cached
      const operator = await this.operatorModel.findOne(
        { _id: operatorId },
        { currentFuel: 1 },
      );

      if (!operator) {
        throw new NotFoundException('(hasEnoughFuel) Operator not found');
      }

      // Cache the result for future use
      await this.cacheFuelValues(
        operatorId,
        operator.currentFuel,
        operator.maxFuel,
      );

      // Check if the operator has enough fuel
      return (
        operator.currentFuel >=
        GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits
      );
    } catch (err: any) {
      throw new Error(`(hasEnoughFuel) Error checking fuel: ${err.message}`);
    }
  }

  /**
   * Finds an operator by their ID
   * @param id - The operator's ID
   * @returns The operator document or null if not found
   */
  async findById(
    id: Types.ObjectId,
    projection?: Record<string, number>,
  ): Promise<Operator | null> {
    const operator = await this.operatorModel.findById(id, projection).lean();
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    return operator;
  }

  /**
   * Finds an operator by their Telegram ID
   * @param id - The operator's ID
   * @returns The operator document or null if not found
   */
  async findByTelegramId(
    id: Types.ObjectId,
    projection?: Record<string, number>,
  ): Promise<Operator | null> {
    const operator = await this.operatorModel
      .findOne(
        {
          'tgProfile.tgId': id,
        },
        projection,
      )
      .lean();

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    return operator;
  }

  /**
   * Finds or creates an operator using Telegram authentication data.
   *
   * Also assigns the operator to a random public pool if still applicable.
   * @param authData - Telegram authentication data
   * @returns The operator's data (or null if not found)
   */
  async findOrCreateOperator(
    authData: {
      id: string;
      username?: string;
      // Optional projection
    },
    projection?: Record<string, number>,
  ): Promise<Operator | null> {
    this.logger.log(
      `🔍 (findOrCreateOperator) Searching for operator with Telegram ID: ${authData.id}`,
    );

    let operator = await this.operatorModel.findOneAndUpdate(
      { 'tgProfile.tgId': authData.id },
      authData.username
        ? { $set: { 'tgProfile.tgUsername': authData.username } }
        : {},
      { new: true, projection },
    );

    if (operator) {
      this.logger.log(
        `✅ (findOrCreateOperator) Found existing operator: ${operator.username}`,
      );
      return operator;
    }

    // If no operator exists, create a new one.
    const baseUsername = authData.username || `tg_${authData.id}`;
    let username = baseUsername;
    let counter = 1;

    while (await this.operatorModel.exists({ username })) {
      username = `${baseUsername}_${counter}`;
      counter++;
    }

    operator = await this.operatorModel.create({
      username,
      assetEquity: 0,
      cumulativeEff: 0,
      effMultiplier: 1,
      maxFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      currentFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      totalEarnedHASH: 0,
      tgProfile: {
        tgId: authData.id,
        tgUsername: authData.username || `user_${authData.id}`,
      },
    });

    // Pick a random pool to join
    const poolId = this.poolService.fetchRandomPublicPoolId();

    if (poolId) {
      try {
        // Attempt to join the pool.
        await this.poolOperatorService.createPoolOperator(
          operator._id,
          new Types.ObjectId(poolId),
        );
      } catch (err: any) {
        // Ignore any errors, because joining a pool is optional.
        this.logger.warn(
          `(findOrCreateOperator) Error joining pool: ${err.message}`,
        );
      }
    }

    // Grant a basic drill to the operator
    await this.drillService
      .createDrill(
        operator._id,
        DrillVersion.BASIC,
        DrillConfig.BASIC,
        false,
        1,
        GAME_CONSTANTS.DRILLS.BASIC_DRILL_STARTING_ACTUAL_EFF,
      )
      .catch((err: any) => {
        this.logger.warn(
          `(findOrCreateOperator) Error granting basic drill: ${err.message}`,
        );
      });

    this.logger.log(
      `🆕(findOrCreateOperator) Created new operator: ${username}`,
    );
    return operator;
  }

  /**
   * Fetches IDs of operators whose fuel has dropped below the minimum threshold.
   * Uses Redis cache when available for better performance.
   * @param activeOperatorIds Set of active operator IDs to check
   * @returns Array of ObjectIds for operators with depleted fuel
   */
  async fetchDepletedOperatorIds(
    activeOperatorIds: Set<Types.ObjectId>,
  ): Promise<Types.ObjectId[]> {
    if (activeOperatorIds.size === 0) {
      return [];
    }

    const depletedOperatorIds: Types.ObjectId[] = [];
    const operatorsToCheckInDB: Types.ObjectId[] = [];

    // First check Redis cache for each operator
    for (const operatorId of activeOperatorIds) {
      const cachedFuel = await this.getCachedFuelValues(operatorId);

      if (cachedFuel) {
        // If cached, check fuel level
        if (
          cachedFuel.currentFuel <
          GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits
        ) {
          depletedOperatorIds.push(operatorId);
        }
      } else {
        // If not cached, add to list to check in DB
        operatorsToCheckInDB.push(operatorId);
      }
    }

    // If there are operators not in cache, check them in the database
    if (operatorsToCheckInDB.length > 0) {
      const depletedOperatorsFromDB = await this.operatorModel
        .find(
          {
            _id: { $in: operatorsToCheckInDB },
            currentFuel: {
              $lt: GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
            },
          },
          { _id: 1 },
        )
        .lean();

      // Add database results to the depleted list
      depletedOperatorIds.push(...depletedOperatorsFromDB.map((op) => op._id));
    }

    return depletedOperatorIds;
  }

  /**
   * Gets the Redis key for operator fuel cache
   * @param operatorId Operator ID
   * @returns Redis key for fuel cache
   */
  private getOperatorFuelCacheKey(operatorId: Types.ObjectId | string): string {
    const operatorIdStr = operatorId.toString();
    return `operator:${operatorIdStr}:fuel`;
  }

  /**
   * Caches operator fuel values in Redis
   * @param operatorId Operator ID
   * @param currentFuel Current fuel value
   * @param maxFuel Maximum fuel value
   */
  private async cacheFuelValues(
    operatorId: Types.ObjectId,
    currentFuel: number,
    maxFuel: number,
  ): Promise<void> {
    const key = this.getOperatorFuelCacheKey(operatorId);
    await this.redisService.set(
      key,
      JSON.stringify({ currentFuel, maxFuel }),
      3600, // 1 hour expiry
    );
  }

  /**
   * Gets cached fuel values from Redis
   * @param operatorId Operator ID
   * @returns Cached fuel values or null if not found
   */
  private async getCachedFuelValues(
    operatorId: Types.ObjectId,
  ): Promise<{ currentFuel: number; maxFuel: number } | null> {
    const key = this.getOperatorFuelCacheKey(operatorId);
    const cachedData = await this.redisService.get(key);

    if (!cachedData) {
      return null;
    }

    try {
      return JSON.parse(cachedData);
    } catch (error) {
      this.logger.error(`Error parsing cached fuel data: ${error.message}`);
      return null;
    }
  }

  /**
   * Depletes fuel for active operators.
   * @param activeOperatorIds Set of operator IDs currently active
   * @param fuelUsed Amount of fuel to deplete
   * @returns Array of affected operators with their updated fuel values
   */
  async depleteFuel(
    activeOperatorIds: Set<Types.ObjectId>,
    fuelUsed: number,
  ): Promise<
    { operatorId: Types.ObjectId; currentFuel: number; maxFuel: number }[]
  > {
    if (activeOperatorIds.size === 0) {
      return [];
    }

    const updatedOperators: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[] = [];
    const bulkWriteOperations = [];
    const operatorFuelData: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[] = [];

    // Process each operator
    for (const operatorId of activeOperatorIds) {
      // Try to get cached fuel values first
      let cachedFuel = await this.getCachedFuelValues(operatorId);

      if (!cachedFuel) {
        // If not cached, fetch from database
        const operator = await this.operatorModel
          .findById(operatorId, { currentFuel: 1, maxFuel: 1 })
          .lean();

        if (!operator) {
          continue; // Skip if operator not found
        }

        cachedFuel = {
          currentFuel: operator.currentFuel,
          maxFuel: operator.maxFuel,
        };
      }

      // Calculate new fuel value
      const newFuel = Math.max(0, cachedFuel.currentFuel - fuelUsed);

      // Add to fuel data for batch caching
      operatorFuelData.push({
        operatorId,
        currentFuel: newFuel,
        maxFuel: cachedFuel.maxFuel,
      });

      // Add to bulk write operations
      bulkWriteOperations.push({
        updateOne: {
          filter: { _id: operatorId },
          update: { $set: { currentFuel: newFuel } },
        },
      });

      // Add to notification list - all operators get notified for real-time updates
      updatedOperators.push({
        operatorId,
        currentFuel: newFuel,
        maxFuel: cachedFuel.maxFuel,
      });
    }

    // Execute operations in parallel
    await Promise.all([
      // Batch cache fuel values in Redis
      this.batchCacheFuelValues(operatorFuelData),

      // Execute bulk write if there are operations
      bulkWriteOperations.length > 0
        ? this.operatorModel.bulkWrite(bulkWriteOperations)
        : Promise.resolve(),
    ]);

    return updatedOperators;
  }

  /**
   * Replenishes fuel for inactive operators up to their max fuel capacity.
   * @param activeOperatorIds Set of operator IDs currently active (to exclude)
   * @param fuelGained Amount of fuel to replenish
   * @returns Array of affected operators with their updated fuel values
   */
  async replenishFuel(
    activeOperatorIds: Set<Types.ObjectId>,
    fuelGained: number,
  ): Promise<
    { operatorId: Types.ObjectId; currentFuel: number; maxFuel: number }[]
  > {
    // First, find all inactive operators that need fuel replenishment
    const inactiveOperators = await this.operatorModel
      .find(
        {
          _id: { $nin: Array.from(activeOperatorIds) },
          $expr: { $lt: ['$currentFuel', '$maxFuel'] },
        },
        { _id: 1, currentFuel: 1, maxFuel: 1 },
      )
      .lean();

    if (inactiveOperators.length === 0) {
      return [];
    }

    const updatedOperators: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[] = [];
    const bulkWriteOperations = [];
    const operatorFuelData: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[] = [];

    // Process each inactive operator
    for (const operator of inactiveOperators) {
      // Try to get cached fuel values first
      let cachedFuel = await this.getCachedFuelValues(operator._id);

      if (!cachedFuel) {
        cachedFuel = {
          currentFuel: operator.currentFuel,
          maxFuel: operator.maxFuel,
        };
      }

      // Calculate new fuel value (capped at max fuel)
      const newFuel = Math.min(
        cachedFuel.maxFuel,
        cachedFuel.currentFuel + fuelGained,
      );

      // Add to fuel data for batch caching
      operatorFuelData.push({
        operatorId: operator._id,
        currentFuel: newFuel,
        maxFuel: cachedFuel.maxFuel,
      });

      // Add to bulk write operations
      bulkWriteOperations.push({
        updateOne: {
          filter: { _id: operator._id },
          update: { $set: { currentFuel: newFuel } },
        },
      });

      // Add to notification list - all operators get notified for real-time updates
      updatedOperators.push({
        operatorId: operator._id,
        currentFuel: newFuel,
        maxFuel: cachedFuel.maxFuel,
      });
    }

    // Execute operations in parallel
    await Promise.all([
      // Batch cache fuel values in Redis
      this.batchCacheFuelValues(operatorFuelData),

      // Execute bulk write if there are operations
      bulkWriteOperations.length > 0
        ? this.operatorModel.bulkWrite(bulkWriteOperations)
        : Promise.resolve(),
    ]);

    return updatedOperators;
  }

  /**
   * Generates a random fuel value between `min` and `max`.
   */
  getRandomFuelValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Batch caches multiple operators' fuel values in Redis
   * @param operatorFuelData Array of operator fuel data
   */
  private async batchCacheFuelValues(
    operatorFuelData: {
      operatorId: Types.ObjectId;
      currentFuel: number;
      maxFuel: number;
    }[],
  ): Promise<void> {
    if (operatorFuelData.length === 0) return;

    const keyValuePairs: Record<string, string> = {};

    // Prepare key-value pairs for batch update
    for (const data of operatorFuelData) {
      const key = this.getOperatorFuelCacheKey(data.operatorId);
      keyValuePairs[key] = JSON.stringify({
        currentFuel: data.currentFuel,
        maxFuel: data.maxFuel,
      });
    }

    // Batch update Redis
    await this.redisService.mset(keyValuePairs);

    // Set expiration for each key (unfortunately Redis doesn't support batch expiry)
    for (const key of Object.keys(keyValuePairs)) {
      await this.redisService.set(key, keyValuePairs[key], 3600); // 1 hour expiry
    }
  }

  /**
   * Gets an operator's current fuel status.
   * First checks Redis cache, then falls back to database if needed.
   * @param operatorId Operator ID
   * @returns Object containing currentFuel and maxFuel, or null if operator not found
   */
  async getOperatorFuelStatus(
    operatorId: Types.ObjectId,
  ): Promise<{ currentFuel: number; maxFuel: number } | null> {
    try {
      // Try to get cached fuel values first for better performance
      const cachedFuel = await this.getCachedFuelValues(operatorId);

      if (cachedFuel) {
        // Use cached value if available
        return cachedFuel;
      }

      // Fall back to database if not cached
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { currentFuel: 1, maxFuel: 1 })
        .lean();

      if (!operator) {
        this.logger.warn(
          `(getOperatorFuelStatus) Operator not found: ${operatorId}`,
        );
        return null;
      }

      // Cache the result for future use
      await this.cacheFuelValues(
        operatorId,
        operator.currentFuel,
        operator.maxFuel,
      );

      return {
        currentFuel: operator.currentFuel,
        maxFuel: operator.maxFuel,
      };
    } catch (error) {
      this.logger.error(`(getOperatorFuelStatus) Error: ${error.message}`);
      return null;
    }
  }
}
