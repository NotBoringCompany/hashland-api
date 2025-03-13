import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Operator } from './schemas/operator.schema';
import { PoolOperatorService } from 'src/pools/pool-operator.service';
import { PoolService } from 'src/pools/pool.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { OperatorWalletService } from './operator-wallet.service';
import { DrillService } from 'src/drills/drill.service';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Drill } from 'src/drills/schemas/drill.schema';
import { OperatorWallet } from './schemas/operator-wallet.schema';
import { AllowedChain } from 'src/common/enums/chain.enum';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    private readonly poolOperatorService: PoolOperatorService,
    private readonly poolService: PoolService,
    private readonly operatorWalletService: OperatorWalletService,
    private readonly drillService: DrillService,
  ) {}

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
   * Updates asset equity, effMultiplier (in Operator), actualEff for basic drills,
   * and adjusts cumulativeEff in the Operator schema.
   */
  async updateAssetEquityForOperator(
    operatorId: Types.ObjectId,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔄 (updateAssetEquityForOperator) Updating asset equity for operator ${operatorId}...`,
      );

      // ✅ Step 1: Fetch the operator's wallets **including chains**
      const walletDocuments = await this.operatorWalletModel
        .find({ operatorId }, { address: 1, chain: 1 }) // Include chain
        .lean();

      if (walletDocuments.length === 0) {
        this.logger.log(
          `⚠️ (updateAssetEquityForOperator) Operator ${operatorId} has no wallets.`,
        );
        return;
      }

      // ✅ Step 2: Fetch total balance in USD (handles multiple chains)
      const newEquity =
        await this.operatorWalletService.fetchTotalBalanceForWallets(
          walletDocuments.map((wallet) => ({
            address: wallet.address,
            chain: wallet.chain as AllowedChain, // Explicitly cast to AllowedChain
          })),
        );

      // ✅ Step 3: Fetch operator document
      const operator = await this.operatorModel
        .findById(operatorId, { assetEquity: 1, cumulativeEff: 1 })
        .lean();
      if (!operator) return;

      // ✅ Step 4: Compute `effMultiplier`
      const newEffMultiplier = this.equityToEffMultiplier(newEquity);

      // ✅ Step 5: Update `actualEff` of **Basic Drill** & Compute `cumulativeEff`
      const newActualEff = this.drillService.equityToActualEff(newEquity);

      const updatedDrill = await this.drillModel.findOneAndUpdate(
        { operatorId, version: DrillVersion.BASIC },
        { $set: { actualEff: newActualEff } },
        { new: true, projection: { actualEff: 1 } }, // Return the updated `actualEff`
      );

      // ✅ Step 6: Compute `cumulativeEff`
      const oldActualEff = updatedDrill ? updatedDrill.actualEff : 0;
      const effDifference = newActualEff - oldActualEff;
      const newCumulativeEff = (operator.cumulativeEff || 0) + effDifference;

      // ✅ Step 7: Update `assetEquity`, `effMultiplier` & `cumulativeEff` in Operator document
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: {
            assetEquity: newEquity,
            effMultiplier: newEffMultiplier,
            cumulativeEff: newCumulativeEff,
          },
        },
      );

      this.logger.log(
        `✅ (updateAssetEquityForOperator) Updated asset equity & effMultiplier for operator ${operatorId}.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ (updateAssetEquityForOperator) Error: ${error.message}`,
      );
    }
  }

  /**
   * Converts an operator's equity to their effMultiplier value.
   */
  private equityToEffMultiplier(equity: number): number {
    return 1 + Math.log(1 + 0.0000596 * equity);
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
   * Checks if the operator currently has enough fuel to start/continue the drilling session.
   */
  async hasEnoughFuel(operatorId: Types.ObjectId): Promise<boolean> {
    try {
      // Fetch the operator's current fuel level
      const operator = await this.operatorModel.findOne(
        {
          _id: operatorId,
        },
        {
          currentFuel: 1,
        },
      );

      if (!operator) {
        throw new NotFoundException('(hasEnoughFuel) Operator not found');
      }

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
   * @param activeOperatorIds Set of active operator IDs to check
   * @returns Array of ObjectIds for operators with depleted fuel
   */
  async fetchDepletedOperatorIds(
    activeOperatorIds: Set<Types.ObjectId>,
  ): Promise<Types.ObjectId[]> {
    return this.operatorModel
      .find(
        {
          _id: { $in: Array.from(activeOperatorIds) },
          currentFuel: {
            $lt: GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
          },
        },
        { _id: 1 },
      )
      .lean()
      .then((operators) => operators.map((op) => op._id));
  }

  /**
   * Depletes fuel for active operators.
   * @param activeOperatorIds Set of operator IDs currently active
   * @param fuelUsed Amount of fuel to deplete
   */
  async depleteFuel(
    activeOperatorIds: Set<Types.ObjectId>,
    fuelUsed: number,
  ): Promise<void> {
    await this.operatorModel.updateMany(
      { _id: { $in: Array.from(activeOperatorIds) } },
      { $inc: { currentFuel: -fuelUsed } },
    );
  }

  /**
   * Replenishes fuel for inactive operators up to their max fuel capacity.
   * @param activeOperatorIds Set of operator IDs currently active (to exclude)
   * @param fuelGained Amount of fuel to replenish
   */
  async replenishFuel(
    activeOperatorIds: Set<Types.ObjectId>,
    fuelGained: number,
  ): Promise<void> {
    await this.operatorModel.updateMany(
      {
        _id: { $nin: Array.from(activeOperatorIds) },
        $expr: { $lt: ['$currentFuel', '$maxFuel'] }, // Only operators with fuel < maxFuel
      },
      [
        {
          $set: {
            currentFuel: {
              $min: ['$maxFuel', { $add: ['$currentFuel', fuelGained] }],
            },
          },
        },
      ],
    );
  }

  /**
   * Generates a random fuel value between `min` and `max`.
   */
  getRandomFuelValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
