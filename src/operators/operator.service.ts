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
import { randomBytes } from 'crypto';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { ReferralService } from 'src/referral/referral.service';

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
    private readonly referralService: ReferralService,
    @InjectModel(HASHReserve.name) private hashReserveModel: Model<HASHReserve>,
  ) {}

  async adminBatchCreateOperators(operatorCount: number, batchSize = 10000) {
    try {
      let totalCreated = 0;

      while (totalCreated < operatorCount) {
        const currentBatchSize = Math.min(
          batchSize,
          operatorCount - totalCreated,
        );

        const operators: Partial<Operator>[] = [];
        const operatorWallets: Partial<OperatorWallet>[] = [];
        const drills: Partial<Drill>[] = [];
        const poolOperators: Partial<PoolOperator>[] = [];

        for (let i = 0; i < currentBatchSize; i++) {
          const _id = new Types.ObjectId();

          operators.push({
            _id,
            usernameData: {
              username: `test_operator_${Math.random().toString(36).substring(2, 19)}`,
              lastRenameTimestamp: null,
            },
            assetEquity: 0,
            cumulativeEff: 0,
            effMultiplier: 1,
            effCredits: 0,
            maxFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
            currentFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
            maxActiveDrillsAllowed:
              GAME_CONSTANTS.DRILLS.INITIAL_ACTIVE_DRILLS_ALLOWED,
            totalEarnedHASH: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          operatorWallets.push({
            operatorId: _id,
            address: `0x${randomBytes(20).toString('hex')}`,
            chain: AllowedChain.BERA,
            signature: 'testSignature',
            signatureMessage: 'testSignatureMessage',
          });

          drills.push({
            operatorId: _id,
            version: DrillVersion.BASIC,
            config: DrillConfig.BASIC,
            extractorAllowed: false,
            active: true,
            level: 1,
            actualEff: 0,
          });

          drills.push({
            operatorId: _id,
            version: DrillVersion.PREMIUM,
            config: DrillConfig.BULWARK,
            extractorAllowed: true,
            active: true,
            level: 1,
            actualEff: 25000,
          });

          poolOperators.push({
            operator: _id,
            pool: new Types.ObjectId('67c59119e13cd025d70558f8'),
            totalRewards: 0,
          });
        }

        await this.operatorModel.insertMany(operators);
        await this.operatorWalletModel.insertMany(operatorWallets);
        await this.drillModel.insertMany(drills);
        await this.poolOperatorModel.insertMany(poolOperators);

        this.logger.log(
          `Created ${totalCreated + currentBatchSize} / ${operatorCount}`,
        );
        totalCreated += currentBatchSize;
      }

      this.logger.log(
        `Successfully created ${operatorCount} operators and related documents.`,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        `(adminBatchCreateOperators) Error batch creating operators: ${err.message}`,
      );
    }
  }

  /**
   * Renames an operator's username.
   */
  async renameUsername(
    operatorId: Types.ObjectId,
    newUsername: string,
  ): Promise<ApiResponse<null>> {
    try {
      if (!newUsername) {
        throw new ForbiddenException(
          `(renameUsername) New username is required.`,
        );
      }

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
   * Updates cumulativeEff for all operators by summing their drills' actualEff values
   * and applying luck factor, effMultiplier and effCredits.
   */
  async updateCumulativeEff() {
    this.logger.log(
      '🔄 (updateCumulativeEff) Updating cumulativeEff for all operators...',
    );
    const startTime = performance.now();

    // ✅ Step 1: Aggregate active drills' actualEff per operator
    const drillEffs = await this.drillModel.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$operatorId',
          totalDrillEff: { $sum: '$actualEff' },
        },
      },
    ]);

    if (drillEffs.length === 0) {
      this.logger.warn(
        '⚠️ (updateCumulativeEff) No active drills found. Skipping update.',
      );
      return;
    }

    // ✅ Step 2: Get operator data (effMultiplier and effCredits)
    const operatorIds = drillEffs.map((d) => d._id);
    const operators = await this.operatorModel
      .find({ _id: { $in: operatorIds } }, { effMultiplier: 1, effCredits: 1 })
      .lean();

    const operatorMap = new Map<
      string,
      { effMultiplier: number; effCredits: number }
    >();
    for (const op of operators) {
      operatorMap.set(op._id.toString(), {
        effMultiplier: op.effMultiplier || 1,
        effCredits: op.effCredits || 0,
      });
    }

    // ✅ Step 3: Compute final cumulativeEff with Luck Factor
    const bulkUpdates = drillEffs
      .map(({ _id, totalDrillEff }) => {
        const operatorData = operatorMap.get(_id.toString());
        if (!operatorData) return null;

        const luckFactor =
          GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER +
          Math.random() *
            (GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER -
              GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER);

        const cumulativeEff =
          totalDrillEff * operatorData.effMultiplier * luckFactor +
          operatorData.effCredits;

        return {
          updateOne: {
            filter: { _id },
            update: { $set: { cumulativeEff } },
          },
        };
      })
      .filter(Boolean);

    // ✅ Step 4: Process in batches
    const batchSize = 1000;
    for (let i = 0; i < bulkUpdates.length; i += batchSize) {
      await this.operatorModel.bulkWrite(bulkUpdates.slice(i, i + batchSize));
      this.logger.log(
        `✅ (updateCumulativeEff) Processed batch ${i / batchSize + 1}/${Math.ceil(bulkUpdates.length / batchSize)}`,
      );
    }

    // ✅ Step 5: Update estimated pool efficiency
    const operatorIdsInPools = await this.poolOperatorModel.aggregate([
      {
        $group: {
          _id: '$pool',
          operatorIds: { $push: '$operatorId' },
        },
      },
    ]);

    if (operatorIdsInPools.length > 0) {
      this.logger.log(
        `🔁 Updating estimated efficiency for ${operatorIdsInPools.length} pools...`,
      );

      const poolBatchSize = 5;
      for (let i = 0; i < operatorIdsInPools.length; i += poolBatchSize) {
        const batchPromises = operatorIdsInPools
          .slice(i, i + poolBatchSize)
          .map((pool) => this.poolService.updatePoolEstimatedEff(pool._id));

        await Promise.all(batchPromises);

        this.logger.log(
          `✅ Processed pool estimatedEff update batch ${Math.floor(i / poolBatchSize) + 1}/${Math.ceil(operatorIdsInPools.length / poolBatchSize)}`,
        );
      }
    }

    const endTime = performance.now();
    this.logger.log(
      `✅ (updateCumulativeEff) Updated cumulativeEff for ${bulkUpdates.length} operators in ${(endTime - startTime).toFixed(2)}ms.`,
    );
  }

  /**
   * Updates cumulativeEff for a specific operator by summing their active drills' actualEff values
   * and applying luck factor, effMultiplier, and effCredits.
   */
  async updateCumulativeEffForSingleOperator(
    operatorId: Types.ObjectId,
  ): Promise<void> {
    this.logger.log(
      `🔄 (updateCumulativeEffForOperator) Updating cumulativeEff for operator ${operatorId}...`,
    );
    const startTime = performance.now();

    // Step 1: Get total actualEff from active drills for this operator
    const drillAgg = await this.drillModel.aggregate([
      { $match: { operatorId, active: true } },
      {
        $group: {
          _id: '$operatorId',
          totalDrillEff: { $sum: '$actualEff' },
        },
      },
    ]);

    if (drillAgg.length === 0) {
      this.logger.warn(
        `⚠️ (updateCumulativeEffForOperator) No active drills found for operator ${operatorId}. Skipping update.`,
      );
      return;
    }

    const totalDrillEff = drillAgg[0].totalDrillEff;

    // Step 2: Get effMultiplier and effCredits for the operator
    const operator = await this.operatorModel
      .findById(operatorId, { effMultiplier: 1, effCredits: 1 })
      .lean();

    if (!operator) {
      this.logger.warn(
        `⚠️ (updateCumulativeEffForOperator) Operator ${operatorId} not found.`,
      );
      return;
    }

    const effMultiplier = operator.effMultiplier || 1;
    const effCredits = operator.effCredits || 0;

    // Step 3: Apply luck factor
    const luckFactor =
      GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER +
      Math.random() *
        (GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER -
          GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER);

    const cumulativeEff =
      totalDrillEff * effMultiplier * luckFactor + effCredits;

    // Step 4: Update operator
    await this.operatorModel.updateOne(
      { _id: operatorId },
      { $set: { cumulativeEff } },
    );

    this.logger.log(
      `✅ (updateCumulativeEffForOperator) Updated cumulativeEff for operator ${operatorId} to ${cumulativeEff.toFixed(
        2,
      )}.`,
    );

    // Step 5: Update pool estimatedEff if this operator is in a pool
    const poolOperator = await this.poolOperatorModel
      .findOne({ operatorId })
      .select('pool')
      .lean();

    if (poolOperator?.pool) {
      await this.poolService.updatePoolEstimatedEff(poolOperator.pool);
      this.logger.log(
        `🔁 Updated estimatedEff for pool ${poolOperator.pool} (operator was part of it).`,
      );
    }

    const endTime = performance.now();
    this.logger.log(
      `⏱ (updateCumulativeEffForOperator) Execution time: ${(endTime - startTime).toFixed(2)}ms.`,
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
   * @param telegramId The Telegram user ID to find
   * @param projection Optional fields to project
   * @returns The operator or null if not found
   */
  async findByTelegramId(
    telegramId: string,
    projection?: Record<string, number>,
  ): Promise<Operator | null> {
    try {
      return await this.operatorModel
        .findOne({ 'tgProfile.tgId': telegramId }, projection)
        .lean();
    } catch (err: any) {
      this.logger.error(
        `(findByTelegramId) Error finding operator by Telegram ID: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Finds an existing operator by Telegram ID or wallet address; creates a new one if none exists.
   * The operator will be associated with a random public pool and granted a basic drill.
   *
   * Also assigns the operator to a random public pool if still applicable.
   * @param authData - Authentication data (Telegram or Wallet)
   * @param projection - Optional projection for fields to include
   * @param referralCode - Optional referral code used during registration
   * @returns The operator's data (or null if not found)
   */
  async findOrCreateOperator(
    authData: {
      id: string;
      username?: string;
      walletAddress?: string;
      walletChain?: string;
    },
    projection?: Record<string, number>,
    referralCode?: string,
  ): Promise<{ operator: Operator; type: 'login' | 'register' } | null> {
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
          return { operator, type: 'login' };
        }
      }

      // If we didn't find in OperatorWallets, check the legacy walletProfile as a fallback
      const operator = await this.operatorModel.findOne(
        { 'walletProfile.address': authData.walletAddress.toLowerCase() },
        projection,
      );

      if (operator) {
        this.logger.log(
          `✅ (findOrCreateOperator) Found existing operator by walletProfile: ${operator.usernameData.username}`,
        );
        return { operator, type: 'login' };
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
        return { operator, type: 'login' };
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
      effCredits: 0,
      maxFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      currentFuel: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
      maxActiveDrillsAllowed: 5,
      totalEarnedHASH: 0,
      referralData: {
        referralCode: null,
        referredBy: null,
        totalReferrals: 0,
        referralRewards: {
          effCredits: 0,
          fuelBonus: 0,
          hashBonus: 0,
        },
      },
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

    // Process referral code if provided
    if (referralCode) {
      this.logger.log(
        `Processing referral code for new operator: ${referralCode}`,
      );
      await this.referralService
        .processReferral(referralCode, operator._id)
        .catch((err) => {
          this.logger.warn(`Error processing referral: ${err.message}`);
        });
    }

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

    // Generate a referral code for the new operator
    this.referralService.getOperatorReferralCode(operator._id).catch((err) => {
      this.logger.warn(`Error generating referral code: ${err.message}`);
    });

    this.logger.log(
      `🆕(findOrCreateOperator) Created new operator: ${username}`,
    );
    return { operator, type: 'register' };
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

  /**
   * Generates or retrieves a unique referral code for an operator
   * @param operatorId The operator's ID
   * @returns The referral code
   */
  async getOperatorReferralCode(
    operatorId: Types.ObjectId,
  ): Promise<{ referralCode: string; isNew: boolean }> {
    try {
      // Check if operator already has a referral code
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { 'referralData.referralCode': 1 })
        .lean();

      if (!operator) {
        throw new NotFoundException(
          '(getOperatorReferralCode) Operator not found',
        );
      }

      // If operator already has a referral code, return it
      if (operator.referralData?.referralCode) {
        return {
          referralCode: operator.referralData.referralCode,
          isNew: false,
        };
      }

      // Generate a new referral code
      const referralCode = this.generateReferralCode(operatorId.toString());

      // Save the referral code to the operator
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: { 'referralData.referralCode': referralCode },
        },
      );

      return { referralCode, isNew: true };
    } catch (error) {
      this.logger.error(
        `(getOperatorReferralCode) Error: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error generating referral code: ${error.message}`,
      );
    }
  }

  /**
   * Generate a unique referral code for a user
   * @param userId - The operator ID to encode
   * @returns A unique referral code
   */
  private generateReferralCode(userId: string): string {
    // Simple encoding to generate a unique code based on user ID and timestamp
    const timestamp = Date.now().toString().slice(-6);
    const buffer = Buffer.from(userId + timestamp);
    return buffer
      .toString('base64')
      .replace(/[/+=]/g, '')
      .substring(0, 8)
      .toUpperCase();
  }

  /**
   * Process a referral when a new user signs up using a referral code
   * @param referralCode The referral code used
   * @param newOperatorId The ID of the newly registered operator
   * @returns Success status and message
   */
  async processReferral(
    referralCode: string,
    newOperatorId: Types.ObjectId,
  ): Promise<{
    success: boolean;
    message: string;
    referrerId?: Types.ObjectId;
  }> {
    try {
      // Find the referring operator
      const referrer = await this.operatorModel.findOne(
        { 'referralData.referralCode': referralCode },
        { _id: 1 },
      );

      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      const referrerId = referrer._id;

      // Make sure the new operator isn't already referred and isn't referring themselves
      if (newOperatorId.equals(referrerId)) {
        return { success: false, message: 'Cannot refer yourself' };
      }

      const newOperator = await this.operatorModel.findById(newOperatorId, {
        'referralData.referredBy': 1,
      });

      if (!newOperator) {
        return { success: false, message: 'New operator not found' };
      }

      if (newOperator.referralData?.referredBy) {
        return { success: false, message: 'Operator already has a referrer' };
      }

      // Update the referrer's stats (increment total referrals)
      await this.operatorModel.updateOne(
        { _id: referrerId },
        { $inc: { 'referralData.totalReferrals': 1 } },
      );

      // Update the new operator with the referrer ID
      await this.operatorModel.updateOne(
        { _id: newOperatorId },
        { $set: { 'referralData.referredBy': referrerId } },
      );

      // Apply referral rewards here (customize based on your needs)
      await this.applyReferralRewards(referrerId, newOperatorId);

      return {
        success: true,
        message: 'Referral processed successfully',
        referrerId,
      };
    } catch (error) {
      this.logger.error(
        `(processReferral) Error: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Error processing referral: ${error.message}`,
      };
    }
  }

  /**
   * Apply rewards to both referrer and referred user
   * @param referrerId ID of the referring operator
   * @param referredId ID of the referred operator
   */
  private async applyReferralRewards(
    referrerId: Types.ObjectId,
    referredId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Example rewards (customize based on your game mechanics)
      const referrerRewards = {
        effCredits: 25,
        fuelBonus: 10,
        hashBonus: 0,
      };

      const referredRewards = {
        effCredits: 10,
        fuelBonus: 5,
        hashBonus: 0,
      };

      // Apply referrer rewards
      await this.operatorModel.updateOne(
        { _id: referrerId },
        {
          $inc: {
            'referralData.referralRewards.effCredits':
              referrerRewards.effCredits,
            'referralData.referralRewards.fuelBonus': referrerRewards.fuelBonus,
            'referralData.referralRewards.hashBonus': referrerRewards.hashBonus,
            effCredits: referrerRewards.effCredits,
            maxFuel: referrerRewards.fuelBonus,
            currentFuel: referrerRewards.fuelBonus,
          },
        },
      );

      // Apply referred user rewards
      await this.operatorModel.updateOne(
        { _id: referredId },
        {
          $inc: {
            effCredits: referredRewards.effCredits,
            maxFuel: referredRewards.fuelBonus,
            currentFuel: referredRewards.fuelBonus,
          },
        },
      );

      // Clear any cached fuel values since we modified them
      await this.redisService.del(this.getOperatorFuelCacheKey(referrerId));
      await this.redisService.del(this.getOperatorFuelCacheKey(referredId));

      this.logger.log(
        `Applied referral rewards: Referrer ${referrerId} (+${referrerRewards.effCredits} EFF, +${referrerRewards.fuelBonus} fuel), ` +
          `Referred ${referredId} (+${referredRewards.effCredits} EFF, +${referredRewards.fuelBonus} fuel)`,
      );
    } catch (error) {
      this.logger.error(
        `(applyReferralRewards) Error: ${error.message}`,
        error.stack,
      );
      // Don't throw - we don't want to break the referral process if rewards fail
    }
  }

  /**
   * Get user ID from a referral code by finding the operator with that code
   * @param referralCode The referral code to look up
   * @returns The operator ID that owns the referral code, or null if not found
   */
  async getUserIdFromReferralCode(
    referralCode: string,
  ): Promise<Types.ObjectId | null> {
    try {
      const operator = await this.operatorModel.findOne(
        { 'referralData.referralCode': referralCode },
        { _id: 1 },
      );

      return operator ? operator._id : null;
    } catch (error) {
      this.logger.error(
        `(getUserIdFromReferralCode) Error: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
