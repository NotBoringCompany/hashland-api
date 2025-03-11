import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Drill } from './schemas/drill.schema';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Operator } from 'src/operators/schemas/operator.schema';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

@Injectable()
export class DrillService {
  private readonly logger = new Logger(DrillService.name);

  constructor(
    @InjectModel(Drill.name)
    private drillModel: Model<Drill>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {}

  /**
   * Fetches the `actualEff` value for basic drills given an operator's weighted asset equity.
   */
  equityToActualEff(equity: number): number {
    const A = 22500; // Controls early exponential boost.
    const B = 0.00001; // Controls how fast the exponential growth slows down.
    const C = 42500; // Controls the logarithmic scaling.
    const D = 0.0002; // Controls logarithmic growth rate.

    return 500 + A * (1 - Math.exp(-B * equity)) + C * Math.log(1 + D * equity);
  }

  /**
   * Calculates the total cumulative EFF from all drills
   * and computes an arbitrary difficulty value for each operator.
   *
   * Returns:
   * - `totalEff`: The total cumulative EFF from all drills.
   * - `operatorMap`: A map of operatorId -> their drilling difficulty.
   */
  async batchCalculateTotalEffAndDrillingDifficulty(): Promise<{
    totalEff: number;
    operatorMap: Map<Types.ObjectId, { drillingDifficulty: number }>;
  }> {
    // ✅ Step 1: Fetch total cumulative EFF from all drills
    const totalCumulativeEffResult = await this.drillModel.aggregate([
      { $group: { _id: null, totalEff: { $sum: '$actualEff' } } },
    ]);

    const totalEff = totalCumulativeEffResult.length
      ? totalCumulativeEffResult[0].totalEff
      : 0;

    if (totalEff === 0) {
      return { totalEff: 0, operatorMap: new Map() }; // No valid drills
    }

    // ✅ Step 2: Fetch total EFF of drills grouped by each operator
    const operatorEffList = await this.drillModel.aggregate([
      { $group: { _id: '$operatorId', operatorEff: { $sum: '$actualEff' } } },
    ]);

    // ✅ Step 3: Compute drilling difficulty per operator
    const operatorMap = new Map<
      Types.ObjectId,
      { drillingDifficulty: number }
    >();

    for (const entry of operatorEffList) {
      const operatorId = entry._id;
      const operatorEff = entry.operatorEff;
      const drillingDifficulty = totalEff / operatorEff;

      operatorMap.set(operatorId, { drillingDifficulty });
    }

    return { totalEff, operatorMap };
  }

  /**
   * Creates a new drill instance.
   *
   * This is called whenever an operator obtains a new drill.
   */
  async createDrill(
    operatorId: Types.ObjectId,
    version: DrillVersion,
    config: DrillConfig,
    extractorAllowed: boolean,
    level: number,
    actualEff: number,
  ): Promise<Types.ObjectId> {
    try {
      const drill = await this.drillModel.create({
        operatorId,
        version,
        config,
        extractorAllowed,
        level,
        actualEff,
      });

      return drill._id;
    } catch (err: any) {
      throw new Error(`(createDrill) Error creating drill: ${err.message}`);
    }
  }

  /**
   * Fetches all drills that have `extractorAllowed` set to `true`.
   *
   * These will be the drills that are eligible to be extractors.
   */
  async fetchEligibleExtractorDrills() {
    return this.drillModel
      .find({ extractorAllowed: true })
      .select('_id actualEff')
      .lean();
  }

  /**
   * Selects an extractor using weighted probability.
   * Uses a dice roll between 0 and the cumulative sum of all (actualEff × effMultiplier × Luck Factor).
   */
  async selectExtractor(): Promise<{
    drillId: Types.ObjectId;
    eff: number;
  } | null> {
    const selectionStartTime = performance.now();

    // ✅ Step 1: Aggregate Eligible Operators & Their Drills in ONE Query
    const eligibleOperators = await this.drillModel.aggregate([
      { $match: { extractorAllowed: true } }, // ✅ Filter drills that are allowed
      {
        $lookup: {
          from: 'operators', // ✅ Join with the Operator collection
          localField: 'operatorId',
          foreignField: '_id',
          as: 'operatorData',
        },
      },
      { $unwind: '$operatorData' }, // ✅ Unwind operatorData array
      {
        $group: {
          _id: '$operatorId',
          effMultiplier: { $first: '$operatorData.effMultiplier' }, // ✅ Get operator's effMultiplier
          drills: { $push: { _id: '$_id', actualEff: '$actualEff' } }, // ✅ Store drill details
        },
      },
    ]);

    if (eligibleOperators.length === 0) {
      this.logger.warn(`⚠️ (selectExtractor) No eligible operators found.`);
      return null;
    }

    // ✅ Step 2: Apply Luck Factor & Compute Weighted EFF
    const operatorsWithLuck = eligibleOperators.map((operator) => {
      const luckFactor =
        GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER +
        Math.random() *
          (GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER -
            GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER);

      return {
        operatorId: operator._id,
        weightedEff: operator.drills.reduce(
          (sum, drill) =>
            sum + drill.actualEff * operator.effMultiplier * luckFactor,
          0,
        ),
        drills: operator.drills,
      };
    });

    // ✅ Step 3: Compute Total Weighted Eff Sum & Dice Roll
    const totalWeightedEff = operatorsWithLuck.reduce(
      (sum, op) => sum + op.weightedEff,
      0,
    );

    if (totalWeightedEff === 0) {
      this.logger.warn(`⚠️ (selectExtractor) No valid weighted EFF found.`);
      return null;
    }

    const diceRoll = Math.random() * totalWeightedEff;
    let cumulativeWeightedEff = 0;
    let selectedOperator: { operatorId: Types.ObjectId; drills: any[] } | null =
      null;

    for (const operator of operatorsWithLuck) {
      cumulativeWeightedEff += operator.weightedEff;
      if (diceRoll <= cumulativeWeightedEff) {
        selectedOperator = operator;
        break;
      }
    }

    if (!selectedOperator) {
      this.logger.warn(
        `⚠️ (selectExtractor) Unexpected error in operator selection.`,
      );
      return null;
    }

    // ✅ Step 4: Select Drill Using Weighted `actualEff`
    const selectedDrills = selectedOperator.drills;

    if (selectedDrills.length === 0) {
      this.logger.warn(
        `⚠️ (selectExtractor) No valid drills found for selected operator.`,
      );
      return null;
    }

    const totalDrillEff = selectedDrills.reduce(
      (sum, drill) => sum + drill.actualEff,
      0,
    );
    const drillDiceRoll = Math.random() * totalDrillEff;
    let cumulativeDrillEff = 0;

    for (const drill of selectedDrills) {
      cumulativeDrillEff += drill.actualEff;
      if (drillDiceRoll <= cumulativeDrillEff) {
        this.logger.log(
          `✅ (selectExtractor) Selected extractor: Drill ${drill._id.toString()} with ${drill.actualEff.toFixed(2)} EFF. Cumulative EFF this cycle: ${totalWeightedEff.toFixed(2)}.`,
        );

        const selectionEndTime = performance.now();
        this.logger.log(
          `⏳ (selectExtractor) Extractor selection took ${(selectionEndTime - selectionStartTime).toFixed(2)}ms.`,
        );

        return {
          drillId: drill._id,
          eff: drill.actualEff,
        };
      }
    }

    return null;
  }

  /**
   * Converts an operator's equity to their effMultiplier value.
   */
  equityToEffMultiplier(equity: number): number {
    return 1 + Math.log(1 + 0.0000596 * equity);
  }
}
