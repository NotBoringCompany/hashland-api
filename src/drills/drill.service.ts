import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Drill } from './schemas/drill.schema';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Operator } from 'src/operators/schemas/operator.schema';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { ApiResponse } from 'src/common/dto/response.dto';

@Injectable()
export class DrillService {
  private readonly logger = new Logger(DrillService.name);

  constructor(
    @InjectModel(Drill.name)
    private drillModel: Model<Drill>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {}

  async addDrillActiveStateAndMaxActiveLimit(): Promise<void> {
    try {
      await this.drillModel.updateMany(
        { active: { $exists: false } },
        { $set: { active: true } },
      );

      await this.operatorModel.updateMany(
        {},
        {
          $set: {
            maxActiveDrillsAllowed:
              GAME_CONSTANTS.DRILLS.INITIAL_ACTIVE_DRILLS_ALLOWED,
          },
        },
      );

      console.log(
        `✅ (addDrillActiveStateAndMaxActiveLimit) Updated drills and operators.`,
      );
    } catch (err: any) {
      this.logger.error(`(activateAllDrills) Error: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `(activateAllDrills) Error: ${err.message}`,
      );
    }
  }

  /**
   * Activates or deactivates a drill for an operator.
   *
   * If `state` is true, the drill will be activated and vice versa.
   */
  async toggleDrillActiveState(
    operatorId: Types.ObjectId,
    drillId: Types.ObjectId,
    state: boolean,
  ): Promise<ApiResponse<null>> {
    try {
      // Fetch operator and count active drills in parallel
      const [operator, activeDrillCount] = await Promise.all([
        this.operatorModel
          .findById(operatorId, { maxActiveDrillsAllowed: 1 })
          .lean(),
        this.drillModel.countDocuments({ operatorId, active: true }),
      ]);

      if (!operator) {
        throw new NotFoundException(
          `(toggleDrillActiveState) Operator ${operatorId} not found.`,
        );
      }

      // Prevent activating if max active drill count is reached
      if (state && activeDrillCount >= operator.maxActiveDrillsAllowed) {
        throw new BadRequestException(
          `(toggleDrillActiveState) Operator has reached the max active drill limit.`,
        );
      }

      // Try to update the drill, skipping BASIC version
      const updatedDrill = await this.drillModel.findOneAndUpdate(
        {
          _id: drillId,
          operatorId,
          version: { $ne: DrillVersion.BASIC },
        },
        { active: state },
        { new: true },
      );

      if (!updatedDrill) {
        throw new BadRequestException(
          `(toggleDrillActiveState) Drill not found, does not belong to operator, or is a Basic Drill (non-toggleable).`,
        );
      }

      // ✅ Recalculate cumulativeEff for active drills
      const totalEff = await this.drillModel.aggregate([
        { $match: { operatorId, active: true } },
        { $group: { _id: null, cumulativeEff: { $sum: '$actualEff' } } },
      ]);

      const cumulativeEff = totalEff[0]?.cumulativeEff || 0;

      await this.operatorModel.updateOne(
        { _id: operatorId },
        { cumulativeEff },
      );

      this.logger.log(
        `✅ (toggleDrillActiveState) Drill ${drillId} ${state ? 'activated' : 'deactivated'} for operator ${operatorId}. New cumulative EFF: ${cumulativeEff}.`,
      );

      return new ApiResponse(200, 'Drill state updated successfully', null);
    } catch (err: any) {
      this.logger.error(
        `(toggleDrillActiveState) Error: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `(toggleDrillActiveState) Error: ${err.message}`,
      );
    }
  }

  /**
   * Calculates the total weighted cumulative EFF from all operators
   * and computes an arbitrary drilling difficulty value for each operator.
   *
   * Returns:
   * - `totalWeightedEff`: The total sum of `cumulativeEff * effMultiplier` across all operators.
   * - `operatorMap`: A map of `operatorId` -> `{ drillingDifficulty, effMultiplier }`
   */
  async batchCalculateTotalEffAndDrillingDifficulty(): Promise<{
    totalWeightedEff: number;
    operatorMap: Map<
      Types.ObjectId,
      { drillingDifficulty: number; effMultiplier: number }
    >;
  }> {
    // ✅ Step 1: Fetch all operators with their cumulativeEff and effMultiplier in ONE query
    const operators = await this.operatorModel
      .find({}, { _id: 1, cumulativeEff: 1, effMultiplier: 1 })
      .lean();

    if (operators.length === 0) {
      return { totalWeightedEff: 0, operatorMap: new Map() }; // No valid operators
    }

    // ✅ Step 2: Compute the total weighted cumulativeEff
    const totalWeightedEff = operators.reduce(
      (sum, operator) => sum + operator.cumulativeEff * operator.effMultiplier,
      0,
    );

    if (totalWeightedEff === 0) {
      return { totalWeightedEff: 0, operatorMap: new Map() }; // No valid operators with EFF
    }

    // ✅ Step 3: Compute drilling difficulty per operator efficiently
    const operatorMap = new Map<
      Types.ObjectId,
      { drillingDifficulty: number; effMultiplier: number }
    >();

    for (const operator of operators) {
      const operatorWeightedEff =
        operator.cumulativeEff * operator.effMultiplier;
      const drillingDifficulty = totalWeightedEff / operatorWeightedEff;

      operatorMap.set(operator._id, {
        drillingDifficulty,
        effMultiplier: operator.effMultiplier,
      });
    }

    return { totalWeightedEff, operatorMap };
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
      const drill: Partial<Drill> = {
        operatorId,
        version,
        config,
        extractorAllowed,
        // Basic drills will always be active since they are given at the beginning
        // They CANNOT be deactivated.
        active: version === DrillVersion.BASIC ? true : false,
        level,
        actualEff,
      };

      // Check how many drills the operator already has that are active.
      // If the drill's `active` property is set to false and the operator's active drill count is less than the allowed amount for the operator,
      // then set the drill's `active` property to true.
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { maxActiveDrillsAllowed: 1 })
        .lean();
      if (!operator) {
        throw new Error(
          `(createDrill) Operator with ID ${operatorId} not found.`,
        );
      }

      const activeDrillCount = await this.drillModel.countDocuments({
        operatorId,
        active: true,
      });

      if (
        drill.active === false &&
        activeDrillCount < operator.maxActiveDrillsAllowed
      ) {
        drill.active = true;
      }

      const insertedDrill = await this.drillModel.create(drill);

      return insertedDrill._id;
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
    drillOperatorId: Types.ObjectId;
    eff: number;
    totalWeightedEff: number;
  } | null> {
    const selectionStartTime = performance.now();

    // ✅ Step 1: Aggregate Eligible Operators & Their Drills in ONE Query
    const eligibleOperators = await this.drillModel.aggregate([
      { $match: { extractorAllowed: true, active: true } }, // ✅ Filter drills that are allowed to be extractors and are active
      {
        $lookup: {
          from: 'Operators', // ✅ Join with the Operator collection
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
          drillOperatorId: selectedOperator.operatorId,
          eff: drill.actualEff,
          totalWeightedEff,
        };
      }
    }

    return {
      drillId: null,
      drillOperatorId: null,
      eff: null,
      totalWeightedEff,
    };
  }

  /**
   * Converts an operator's equity to their effMultiplier value.
   */
  equityToEffMultiplier(equity: number): number {
    return 1 + Math.log(1 + 0.0000596 * equity);
  }
}
