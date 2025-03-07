import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Drill } from './schemas/drill.schema';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';

@Injectable()
export class DrillService {
  private readonly logger = new Logger(DrillService.name);

  constructor(
    @InjectModel(Drill.name)
    private drillModel: Model<Drill>,
  ) {}

  /**
   * Calculates the total cumulative EFF from all drills and
   * an arbitrary difficulty value for ALL operators in one query.
   */
  async batchCalculateTotalEffAndDrillingDifficulty(): Promise<
    Map<Types.ObjectId, { totalEff: number; drillingDifficulty: number }>
  > {
    // ✅ Step 1: Fetch total cumulative EFF from all drills
    const totalCumulativeEff = await this.drillModel.aggregate([
      { $group: { _id: null, totalEff: { $sum: '$actualEff' } } },
    ]);

    if (!totalCumulativeEff.length || totalCumulativeEff[0].totalEff === 0) {
      return new Map(); // No EFF exists
    }

    const totalEff = totalCumulativeEff[0].totalEff;

    // ✅ Step 2: Fetch total EFF grouped by each operator
    const operatorEffList = await this.drillModel.aggregate([
      { $group: { _id: '$operatorId', operatorEff: { $sum: '$actualEff' } } },
    ]);

    // ✅ Step 3: Compute difficulty for each operator
    const result = new Map<
      Types.ObjectId,
      { totalEff: number; drillingDifficulty: number }
    >();

    for (const entry of operatorEffList) {
      const operatorId = entry._id;
      const operatorEff = entry.operatorEff;
      const drillingDifficulty = totalEff / operatorEff;

      result.set(operatorId, { totalEff, drillingDifficulty });
    }

    return result;
  }

  // /**
  //  * Calculates the total cumulative EFF from all drills and
  //  * an arbitrary difficulty value to determine
  //  * how difficult it is to drill for $HASH this cycle for an operator.
  //  */
  // async calculateTotalEffAndDrillingDifficulty(
  //   operatorId: Types.ObjectId,
  // ): Promise<{
  //   totalEff: number;
  //   drillingDifficulty: number;
  // }> {
  //   // ✅ Step 1: Fetch total cumulative EFF from all drills
  //   const totalCumulativeEff = await this.drillModel.aggregate([
  //     { $group: { _id: null, totalEff: { $sum: '$actualEff' } } },
  //   ]);

  //   if (!totalCumulativeEff.length || totalCumulativeEff[0].totalEff === 0) {
  //     return {
  //       totalEff: 0,
  //       drillingDifficulty: 0,
  //     };
  //   }

  //   // ✅ Step 2: Fetch total EFF of drills owned by the given operator
  //   const operatorTotalEff = await this.drillModel.aggregate([
  //     { $match: { operatorId } }, // Filter by operator
  //     { $group: { _id: null, operatorEff: { $sum: '$actualEff' } } },
  //   ]);

  //   if (!operatorTotalEff.length || operatorTotalEff[0].operatorEff === 0) {
  //     return {
  //       totalEff: totalCumulativeEff[0].totalEff,
  //       drillingDifficulty: 0,
  //     };
  //   }

  //   // ✅ Step 3: Compute drilling difficulty
  //   const drillingDifficulty =
  //     totalCumulativeEff[0].totalEff / operatorTotalEff[0].operatorEff;

  //   return {
  //     totalEff: totalCumulativeEff[0].totalEff,
  //     drillingDifficulty,
  //   };
  // }

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
   * Selects an extractor using weighted probability with a luck factor.
   * Uses a dice roll between 0 and the cumulative sum of all (EFF × Luck Factor).
   */
  async selectExtractor(): Promise<{
    drillId: Types.ObjectId;
    eff: number;
  } | null> {
    const selectionStartTime = performance.now(); // ✅ Performance tracking

    const eligibleDrills = await this.fetchEligibleExtractorDrills();

    if (eligibleDrills.length === 0) {
      this.logger.warn(
        `⚠️ No eligible drills found. Skipping extractor selection.`,
      );
      return null;
    }

    // Apply Luck Factor
    const drillsWithLuck = eligibleDrills.map((drill) => {
      const luckFactor = 1 + Math.random() * 0.1; // 1.00 to 1.10
      return { ...drill, weightedEFF: drill.actualEff * luckFactor };
    });

    // Calculate total weighted EFF
    const totalWeightedEFF = drillsWithLuck.reduce(
      (sum, drill) => sum + drill.weightedEFF,
      0,
    );

    if (totalWeightedEFF === 0) {
      this.logger.warn(`⚠️ No valid EFF found for extractor selection.`);
      return null;
    }

    // 🎲 Roll a random number between 0 and totalWeightedEFF
    const diceRoll = Math.random() * totalWeightedEFF;
    let cumulativeWeightedEFF = 0;

    for (const drill of drillsWithLuck) {
      cumulativeWeightedEFF += drill.weightedEFF;
      if (diceRoll <= cumulativeWeightedEFF) {
        this.logger.log(
          `✅ Selected extractor: Drill ${drill._id.toString()} with ${drill.weightedEFF.toFixed(2)} weighted EFF`,
        );

        const selectionEndTime = performance.now(); // ✅ Performance tracking

        this.logger.log(
          `⏳ (selectExtractor) Extractor selection took ${(
            selectionEndTime - selectionStartTime
          ).toFixed(2)}ms.`,
        );

        return {
          drillId: drill._id,
          eff: drill.weightedEFF,
        };
      }
    }

    this.logger.warn(
      `⚠️ (selectExtractor) Unexpected error in extractor selection.`,
    );

    const selectionEndTime = performance.now(); // ✅ Performance tracking

    this.logger.log(
      `⏳ (selectExtractor) Extractor selection (failed) took ${(
        selectionEndTime - selectionStartTime
      ).toFixed(2)}ms.`,
    );

    return null; // Fallback case
  }
}
