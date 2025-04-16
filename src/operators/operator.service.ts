import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { HASHReserve } from 'src/hash-reserve/schemas/hash-reserve.schema';

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
    @InjectModel(HASHReserve.name) private hashReserveModel: Model<HASHReserve>,
  ) {}

  /**
   * Renames an operator's username.
   */
  async renameUsername(
    operatorId: Types.ObjectId,
    newUsername: string,
  ): Promise<ApiResponse<null>> {
    try {
      // ENsure that the new username meets the following requirements:
      // Max 16 characters, only `-_` and alphanumeric characters allowed
      const usernameRegex = /^[a-zA-Z0-9-_]{1,16}$/;

      if (!usernameRegex.test(newUsername)) {
        throw new ForbiddenException(
          `(renameUsername) Invalid username format. Only alphanumeric characters, dashes, and underscores are allowed.`,
        );
      }

      // Check if the username already exists
      const existingOperator = await this.operatorModel.exists({
        'usernameData.username': newUsername,
      });

      if (existingOperator) {
        throw new ForbiddenException(
          `(renameUsername) Username already taken.`,
        );
      }

      // Ensure that the 7 day cooldown has passed and that the username isn't the same
      const operator = await this.operatorModel.findOne(
        { _id: operatorId },
        { usernameData: 1 },
      );

      if (!operator) {
        throw new NotFoundException(`(renameUsername) Operator not found`);
      }

      if (operator.usernameData.username === newUsername) {
        throw new ForbiddenException(
          `(renameUsername) New username is the same as the current one.`,
        );
      }

      const lastRenameTimestamp = operator.usernameData.lastRenameTimestamp;
      const currentTime = new Date();

      if (
        lastRenameTimestamp &&
        currentTime.getTime() - lastRenameTimestamp.getTime() <
          GAME_CONSTANTS.OPERATORS.RENAME_COOLDOWN
      ) {
        throw new ForbiddenException(
          `(renameUsername) You can only change your username once every 7 days.`,
        );
      }

      this.logger.debug(
        `(renameUsername) Checks complete. Operator ${operatorId} is changing username from ${operator.usernameData.username} to ${newUsername}`,
      );

      // Update the operator's username
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: {
            'usernameData.username': newUsername,
            'usernameData.lastRenameTimestamp': new Date(),
          },
        },
      );

      return new ApiResponse<null>(
        200,
        `(renameUsername) Username changed successfully`,
        null,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        `(renameUsername) Error renaming operator username: ${err.message}`,
      );
    }
  }

  /**
   * Fetches the overview data for all operators in Hashland.
   * Includes:
   * - Total number of operators
   * - Total $HASH extracted by all operators
   * - Estimated asset equity for a given operator
   * - Total $HASH in the reserve
   */
  async fetchOverviewData(operatorId: Types.ObjectId): Promise<
    ApiResponse<{
      assetEquity: number;
      totalOperators: number;
      totalHASHExtracted: number;
      totalHASHReserve: number;
    }>
  > {
    try {
      // Run all queries in parallel
      const [operator, totalOperators, hashExtractedAgg, hashReserve] =
        await Promise.all([
          this.operatorModel
            .findOne({ _id: operatorId }, { assetEquity: 1 })
            .lean(),

          this.operatorModel.countDocuments(),

          this.operatorModel.aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: '$totalEarnedHASH' },
              },
            },
          ]),

          this.hashReserveModel.findOne({}, { totalHASH: 1, _id: 0 }).lean(),
        ]);

      if (!operator) {
        return new ApiResponse(404, `(fetchOverviewData) Operator not found`);
      }

      const totalHASHExtracted = hashExtractedAgg?.[0]?.total || 0;
      const totalHASHReserve = hashReserve?.totalHASH || 0;

      return new ApiResponse(
        200,
        `(fetchOverviewData) Overview data fetched successfully`,
        {
          assetEquity: operator.assetEquity,
          totalOperators,
          totalHASHExtracted,
          totalHASHReserve,
        },
      );
    } catch (err: any) {
      return new ApiResponse(
        500,
        `(fetchOverviewData) Error fetching overview data: ${err.message}`,
      );
    }
  }

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
      const drills = await this.drillModel.find({ operatorId }).lean();

      // Fetch operator's pool ID if in a pool
      const poolId = await this.poolOperatorModel
        .findOne({ operator: operatorId }, { pool: 1 })
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
        poolId: poolId?.pool,
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
    // Make sure to only include active drills
    const operatorEffData = await this.drillModel.aggregate([
      {
        $match: { active: true }, // ✅ Only include active drills
      },
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

    // ✅ Step 4: Get operators that are in pools
    const operatorIdsInPools = await this.poolOperatorModel.aggregate([
      {
        $group: {
          _id: '$poolId',
          operatorIds: { $push: '$operatorId' },
        },
      },
    ]);

    // ✅ Step 5: If there are operators in pools, update pool estimated efficiency
    if (operatorIdsInPools.length > 0) {
      this.logger.log(
        `Updating estimated efficiency for ${operatorIdsInPools.length} pools...`,
      );

      try {
        // Process in batches to avoid overloading the system
        const poolBatchSize = 5;
        for (let i = 0; i < operatorIdsInPools.length; i += poolBatchSize) {
          const batchPromises = operatorIdsInPools
            .slice(i, i + poolBatchSize)
            .map((pool) =>
              this.poolService.updatePoolEstimatedEff(pool._id, true),
            );

          await Promise.all(batchPromises);

          this.logger.log(
            `Processed pool estimatedEff update batch ${Math.floor(i / poolBatchSize) + 1}/${Math.ceil(operatorIdsInPools.length / poolBatchSize)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error updating pool estimated efficiency: ${error.message}`,
          error.stack,
        );
        // Continue execution as this is a non-critical operation
      }
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
        { $inc: { totalEarnedHASH: amount } },
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
   * Finds an existing operator by Telegram ID or wallet address; creates a new one if none exists.
   * The operator will be associated with a random public pool and granted a basic drill.
   *
   * Also assigns the operator to a random public pool if still applicable.
   * @param authData - Authentication data (Telegram or Wallet)
   * @returns The operator's data (or null if not found)
   */
  async findOrCreateOperator(
    authData: {
      id: string;
      username?: string;
      walletAddress?: string;
      walletChain?: string;
      // Optional projection
    },
    projection?: Record<string, number>,
  ): Promise<Operator | null> {
    if (authData.walletAddress) {
      // This is a wallet-based authentication
      this.logger.log(
        `🔍 (findOrCreateOperator) Searching for operator with wallet address: ${authData.walletAddress}`,
      );

      // Check if the wallet is already linked to an operator in the OperatorWallets collection
      const existingWallet = await this.operatorWalletModel.findOne({
        address: authData.walletAddress,
        chain: authData.walletChain,
      });

      if (existingWallet) {
        // Found the wallet, now get the operator it belongs to
        const operator = await this.operatorModel.findById(
          existingWallet.operatorId,
          projection,
        );

        if (operator) {
          this.logger.log(
            `✅ (findOrCreateOperator) Found existing operator by wallet in OperatorWallets: ${operator.usernameData.username}`,
          );
          return operator;
        }
      }

      // If we didn't find in OperatorWallets, check the legacy walletProfile as a fallback
      const operator = await this.operatorModel.findOne(
        { 'walletProfile.address': authData.walletAddress },
        projection,
      );

      if (operator) {
        this.logger.log(
          `✅ (findOrCreateOperator) Found existing operator by walletProfile: ${operator.usernameData.username}`,
        );
        return operator;
      }
    } else {
      // This is a Telegram-based authentication
      this.logger.log(
        `🔍 (findOrCreateOperator) Searching for operator with Telegram ID: ${authData.id}`,
      );

      const operator = await this.operatorModel.findOneAndUpdate(
        { 'tgProfile.tgId': authData.id },
        authData.username
          ? { $set: { 'tgProfile.tgUsername': authData.username } }
          : {},
        { new: true, projection },
      );

      if (operator) {
        this.logger.log(
          `✅ (findOrCreateOperator) Found existing operator: ${operator.usernameData.username}`,
        );
        return operator;
      }
    }

    // If no operator exists, create a new one.
    const baseUsername =
      authData.username ||
      (authData.walletAddress
        ? `wallet_${authData.walletAddress.substring(0, 8).toLowerCase()}`
        : `tg_${authData.id}`);

    let username = baseUsername;
    let counter = 1;

    while (
      await this.operatorModel.exists({ 'usernameData.username': username })
    ) {
      username = `${baseUsername}_${counter}`;
      counter++;
    }

    const operatorData: Partial<Operator> = {
      usernameData: {
        username,
        lastRenameTimestamp: null,
      },
      assetEquity: 0,
      cumulativeEff: 0,
      effMultiplier: 1,
      maxFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      currentFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      maxActiveDrillsAllowed: 5,
      totalEarnedHASH: 0,
    };

    // Add the appropriate profile based on authentication method
    if (authData.walletAddress && authData.walletChain) {
      operatorData.walletProfile = {
        address: authData.walletAddress,
        chain: authData.walletChain,
      };
      operatorData.tgProfile = null;
    } else {
      operatorData.tgProfile = {
        tgId: authData.id,
        tgUsername: authData.username || `user_${authData.id}`,
      };
      operatorData.walletProfile = null;
    }

    const operator = await this.operatorModel.create(operatorData);

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
        0,
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
      const parsed = JSON.parse(cachedData);

      // Validate that we have valid numeric values
      if (parsed && typeof parsed === 'object') {
        const currentFuel = parseFloat(parsed.currentFuel);
        const maxFuel = parseFloat(parsed.maxFuel);

        // Return only if both values are valid numbers
        if (!isNaN(currentFuel) && !isNaN(maxFuel)) {
          return {
            currentFuel,
            maxFuel,
          };
        }

        // Log warning if invalid values were found
        this.logger.warn(
          `Invalid fuel values in Redis for operator ${operatorId}: ${cachedData}`,
        );
      }

      // Return null if validation failed
      return null;
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
      // Cache fuel values in Redis (handle each operator individually)
      ...operatorFuelData.map((data) =>
        this.cacheFuelValues(data.operatorId, data.currentFuel, data.maxFuel),
      ),

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

      // Ensure values are valid numbers
      const currentFuel = isNaN(cachedFuel.currentFuel)
        ? 0
        : cachedFuel.currentFuel;
      const maxFuel = isNaN(cachedFuel.maxFuel) ? 100 : cachedFuel.maxFuel;

      // Calculate new fuel value (capped at max fuel)
      const newFuel = Math.min(maxFuel, currentFuel + fuelGained);

      // Only include operators whose fuel actually changed
      if (newFuel > currentFuel) {
        // Add to fuel data for batch caching
        operatorFuelData.push({
          operatorId: operator._id,
          currentFuel: newFuel,
          maxFuel,
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
          maxFuel,
        });
      }
    }

    // Skip if there are no operators to update
    if (updatedOperators.length === 0) {
      return [];
    }

    // Execute operations in parallel
    await Promise.all([
      // Cache fuel values in Redis (handle each operator individually)
      ...operatorFuelData.map((data) =>
        this.cacheFuelValues(data.operatorId, data.currentFuel, data.maxFuel),
      ),

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
    const validEntries: string[] = [];

    // Prepare key-value pairs for batch update
    for (const data of operatorFuelData) {
      // Validate fuel values before caching
      if (isNaN(data.currentFuel) || isNaN(data.maxFuel)) {
        this.logger.warn(
          `Skipping invalid fuel values for operator ${data.operatorId}: currentFuel=${data.currentFuel}, maxFuel=${data.maxFuel}`,
        );
        continue;
      }

      const key = this.getOperatorFuelCacheKey(data.operatorId);
      keyValuePairs[key] = JSON.stringify({
        currentFuel: data.currentFuel,
        maxFuel: data.maxFuel,
      });
      validEntries.push(key);
    }

    if (Object.keys(keyValuePairs).length === 0) {
      return; // No valid entries to cache
    }

    // Batch update Redis
    await this.redisService.mset(keyValuePairs);

    // Set expiration for each key (unfortunately Redis doesn't support batch expiry)
    for (const key of validEntries) {
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
