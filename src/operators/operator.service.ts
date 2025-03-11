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

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
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
   * Updates weighted asset equity, effMultiplier, actualEff for basic drills,
   * and adjusts cumulativeEff in Operator schema.
   */
  async updateWeightedAssetEquityRelatedData() {
    this.logger.log(
      '🔄 (updateWeightedAssetEquityRelatedData) Updating weighted asset equity, effMultiplier, actualEff for basic drills, and cumulativeEff...',
    );

    // ✅ Step 1: Fetch aggregated TON balances **per operator**
    const p1StartTime = performance.now();
    const operatorBalances =
      await this.operatorWalletService.fetchAllWalletBalances();
    const p1EndTime = performance.now();

    this.logger.log(
      `🔢 (updateWeightedAssetEquityRelatedData) Fetched TON balances for ${operatorBalances.size} operators in ${(
        p1EndTime - p1StartTime
      ).toFixed(2)}ms`,
    );

    // ✅ Step 2: Fetch TON/USD price
    const p2StartTime = performance.now();
    const tonUsdRate = await this.operatorWalletService.fetchTonToUsdRate();
    const p2EndTime = performance.now();

    this.logger.log(
      `💰 (updateWeightedAssetEquityRelatedData) Fetched TON/USD rate: ${tonUsdRate} in ${(
        p2EndTime - p2StartTime
      ).toFixed(2)}ms`,
    );

    // ✅ Step 3: Fetch **ONLY operators that have wallet balances**
    const p3StartTime = performance.now();
    const operatorIds = Array.from(operatorBalances.keys());

    const operators = await this.operatorModel
      .find(
        { _id: { $in: operatorIds } },
        { _id: 1, weightedAssetEquity: 1, cumulativeEff: 1 },
      )
      .lean();
    const p3EndTime = performance.now();

    this.logger.log(
      `🔍 (updateWeightedAssetEquityRelatedData) Fetched ${operators.length} operators in ${(
        p3EndTime - p3StartTime
      ).toFixed(2)}ms`,
    );

    // ✅ Step 4: Fetch ALL basic drills in **one query** to get previous `actualEff`
    const p4StartTime = performance.now();
    const basicDrills = await this.drillModel
      .find(
        { version: DrillVersion.BASIC, operatorId: { $in: operatorIds } },
        { operatorId: 1, actualEff: 1 },
      )
      .lean();
    const p4EndTime = performance.now();

    this.logger.log(
      `🔍 (updateWeightedAssetEquityRelatedData) Fetched ${basicDrills.length} basic drills in ${(
        p4EndTime - p4StartTime
      ).toFixed(2)}ms`,
    );

    // ✅ Step 5: Compute new equity, effMultiplier, actualEff, and cumulativeEff for each operator
    const p5StartTime = performance.now();
    const bulkOperatorUpdates = [];
    const bulkDrillUpdates = [];

    // Create a map of operator's basic drill actualEff values
    const basicDrillMap = new Map<string, number>();
    basicDrills.forEach((drill) => {
      basicDrillMap.set(drill.operatorId.toString(), drill.actualEff);
    });

    for (const operator of operators) {
      const newEquity =
        (operatorBalances.get(operator._id.toString()) || 0) * tonUsdRate;
      const newWeightedEquity =
        (operator.weightedAssetEquity || 0) * 0.85 + newEquity * 0.15;

      // Compute effMultiplier
      const effMultiplier = this.equityToEffMultiplier(newWeightedEquity);

      // ✅ Compute `actualEff` of the operator's **basic drill only**
      const newActualEff =
        this.drillService.equityToActualEff(newWeightedEquity);
      const oldActualEff = basicDrillMap.get(operator._id.toString()) || 0;

      // ✅ Compute **difference** and adjust `cumulativeEff`
      const effDifference = newActualEff - oldActualEff;
      const newCumulativeEff = (operator.cumulativeEff || 0) + effDifference;

      // ✅ **Single bulk update** for the Operator schema (merging cumulativeEff)
      bulkOperatorUpdates.push({
        updateOne: {
          filter: { _id: operator._id },
          update: {
            $set: {
              weightedAssetEquity: newWeightedEquity,
              effMultiplier,
              cumulativeEff: newCumulativeEff, // ✅ Merged cumulativeEff update
            },
          },
        },
      });

      // ✅ Bulk update for drills
      bulkDrillUpdates.push({
        updateOne: {
          filter: { operatorId: operator._id, version: DrillVersion.BASIC }, // ✅ Ensure only BASIC drills are updated
          update: {
            $set: { actualEff: newActualEff },
          },
        },
      });
    }
    const p5EndTime = performance.now();

    this.logger.log(
      `🔧 (updateWeightedAssetEquityRelatedData) Computed new equity, effMultiplier, actualEff & cumulativeEff for ${operators.length} operators in ${(
        p5EndTime - p5StartTime
      ).toFixed(2)}ms`,
    );

    // ✅ Step 6: Perform **batched** bulk updates for Operator & Drill in a single pass
    const p6StartTime = performance.now();
    const batchSize = 1000; // ✅ Set batch size to prevent overload

    for (let i = 0; i < bulkOperatorUpdates.length; i += batchSize) {
      const operatorBatch = bulkOperatorUpdates.slice(i, i + batchSize);
      await this.operatorModel.bulkWrite(operatorBatch);
      this.logger.log(
        `✅ (updateWeightedAssetEquityRelatedData) Processed operator batch ${
          i / batchSize + 1
        }/${Math.ceil(bulkOperatorUpdates.length / batchSize)} (${operatorBatch.length} updates)`,
      );
    }

    for (let i = 0; i < bulkDrillUpdates.length; i += batchSize) {
      const drillBatch = bulkDrillUpdates.slice(i, i + batchSize);
      await this.drillModel.bulkWrite(drillBatch);
      this.logger.log(
        `✅ (updateWeightedAssetEquityRelatedData) Processed drill batch ${
          i / batchSize + 1
        }/${Math.ceil(bulkDrillUpdates.length / batchSize)} (${drillBatch.length} updates)`,
      );
    }

    const p6EndTime = performance.now();

    this.logger.log(
      `📝 (updateWeightedAssetEquityRelatedData) Updated weighted asset equity, effMultiplier, actualEff & cumulativeEff for ${operators.length} operators in ${(
        p6EndTime - p6StartTime
      ).toFixed(2)}ms`,
    );

    this.logger.log(
      `✅ Finished updating weighted asset equity, effMultiplier, actualEff & cumulativeEff for ${operators.length} operators.`,
    );
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
  async findById(id: string): Promise<Operator | null> {
    const operator = await this.operatorModel.findById(new Types.ObjectId(id));
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
  async findByTelegramId(id: string): Promise<Operator | null> {
    const operator = await this.operatorModel
      .findOne({
        'tgProfile.tgId': id,
      })
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
  async findOrCreateOperator(authData: {
    id: string;
    username?: string;
  }): Promise<Operator | null> {
    this.logger.log(
      `🔍 (findOrCreateOperator) Searching for operator with Telegram ID: ${authData.id}`,
    );

    let operator = await this.operatorModel.findOneAndUpdate(
      { 'tgProfile.tgId': authData.id },
      authData.username
        ? { $set: { 'tgProfile.tgUsername': authData.username } }
        : {},
      { new: true },
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
      // Update this with checking the operator's weighted asset equity later on.
      weightedAssetEquity: 0,
      // Update this with checking the operator's weighted asset equity later on.
      effMultiplier: 1,
      cumulativeEff: 0,
      maxFuel: GAME_CONSTANTS.OPERATOR.OPERATOR_STARTING_FUEL,
      currentFuel: GAME_CONSTANTS.OPERATOR.OPERATOR_STARTING_FUEL,
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
        $expr: { $lt: ['$currentFuel', '$maxFuel'] },
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
