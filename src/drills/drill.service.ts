import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import mongoose from 'mongoose';
import { Drill } from './schemas/drill.schema';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { Operator } from 'src/operators/schemas/operator.schema';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { ApiResponse } from 'src/common/dto/response.dto';
import { DrillingSession } from './schemas/drilling-session.schema';

/**
 * Type for the change stream events for the drills collection.
 */
type DrillChangeEvent =
  | mongoose.mongo.ChangeStreamInsertDocument<Drill>
  | mongoose.mongo.ChangeStreamUpdateDocument<Drill>
  | mongoose.mongo.ChangeStreamReplaceDocument<Drill>
  | mongoose.mongo.ChangeStreamDeleteDocument;

@Injectable()
export class DrillService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrillService.name);

  // ⬇️ In-memory cache of eligible drills that can be extractors
  private eligibleExtractorDrills = new Map<
    string,
    { eff: number; operatorId: Types.ObjectId }
  >();

  // ⬇️ Change stream for the drills collection (to watch for changes)
  private changeStream: mongoose.mongo.ChangeStream;

  constructor(
    @InjectModel(Drill.name)
    private drillModel: Model<Drill>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
  ) {}

  /**
   * On app start: load all active drills with `extractorAllowed` set to true into memory and
   * subscribe to changeStream for incremental updates
   */
  async onModuleInit() {
    // 1) initial load (covered by compound index)
    const cursor = this.drillModel
      .find(
        { extractorAllowed: true, active: true },
        { actualEff: 1, operatorId: 1 },
      )
      .lean()
      .cursor({ batchSize: 20_000 });

    for await (const doc of cursor) {
      this.eligibleExtractorDrills.set(doc._id.toHexString(), {
        eff: doc.actualEff,
        operatorId: doc.operatorId,
      });
    }

    // 2) subscribe to changes
    this.changeStream = this.drillModel.watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
        },
      },
    ]);

    this.changeStream.on('change', (change) => {
      this.handleDrillsChange(change as DrillChangeEvent);
    });
  }

  /**
   * Handle incremental drill updates so the cache stays fresh
   */
  private async handleDrillsChange(change: DrillChangeEvent) {
    const id = change.documentKey._id.toString();

    if (change.operationType === 'delete') {
      this.eligibleExtractorDrills.delete(id);
      return;
    }

    // on insert/replace/update—re-fetch that one doc
    const doc = await this.drillModel
      .findById(id, {
        actualEff: 1,
        operatorId: 1,
        extractorAllowed: 1,
        active: 1,
      })
      .lean();

    if (doc && doc.extractorAllowed && doc.active) {
      this.eligibleExtractorDrills.set(id, {
        eff: doc.actualEff,
        operatorId: doc.operatorId,
      });
    } else {
      this.eligibleExtractorDrills.delete(id);
    }
  }

  /**
   * Cleans up the change stream on shutdown.
   */
  onModuleDestroy() {
    this.changeStream?.close();
  }

  /**
   * Selects an extractor using weighted probability.
   * Now runs entirely in-memory over `this.eligibleExtractorDrills`.
   */
  selectExtractor(): {
    drillId: Types.ObjectId;
    drillOperatorId: Types.ObjectId;
    eff: number;
    totalWeightedEff: number;
  } | null {
    const MIN = GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER;
    const MAX = GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER;

    if (this.eligibleExtractorDrills.size === 0) {
      this.logger.warn(`⚠️ (selectExtractor) No eligible drills found.`);
      return null;
    }

    // One-pass streaming weighted sampling
    let selected: {
      id: string;
      eff: number;
      operatorId: Types.ObjectId;
    } | null = null;
    let totalW = 0;

    // Compute a 'seed-always-select first' system.
    // The first drill will be the first selected, then the second drill has a chance to knock it out of the extractor spot, and the third drill
    // has a chance to knock either Drill 1 or 2 (whichever remains in place) out, and so on.
    // This is more efficient than the two-step approach.
    for (const [id, { eff, operatorId }] of this.eligibleExtractorDrills) {
      const luck = MIN + Math.random() * (MAX - MIN);
      const w = eff * luck;
      totalW += w;
      // keep this item with probability w/totalW
      if (Math.random() * totalW < w) {
        selected = { id, eff, operatorId };
      }
    }

    if (!selected) {
      this.logger.warn(`⚠️ (selectExtractor) Floating-point fallback.`);
      return null;
    }

    this.logger.log(
      `✅ (selectExtractor) Selected extractor: Drill ${selected.id} with ${selected.eff.toFixed(
        2,
      )} EFF. Total W: ${totalW.toFixed(2)}.`,
    );

    return {
      drillId: new Types.ObjectId(selected.id),
      drillOperatorId: selected.operatorId,
      eff: selected.eff,
      totalWeightedEff: totalW,
    };
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
          .findById(operatorId, {
            maxActiveDrillsAllowed: 1,
            effCredits: 1,
            effMultiplier: 1,
          })
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

      // Prevent toggling if the operator has an active drilling session
      const activeDrillingSession = await this.drillingSessionModel.exists({
        operatorId,
        startTime: { $lte: new Date() },
        endTime: null,
      });

      if (activeDrillingSession) {
        throw new BadRequestException(
          `(toggleDrillActiveState) Operator has an active drilling session.`,
        );
      }

      if (activeDrillingSession) {
        throw new BadRequestException(
          `(toggleDrillActiveState) Operator has an active drilling session.`,
        );
      }

      // Try to update the drill, skipping BASIC version
      // Also includes the requirement that the drill has not been toggled in the last `ACTIVE_STATE_TOGGLE_COOLDOWN` seconds.
      const updatedDrill = await this.drillModel.findOneAndUpdate(
        {
          _id: drillId,
          operatorId,
          version: { $ne: DrillVersion.BASIC },
          $or: [
            { lastActiveStateToggle: null },
            {
              lastActiveStateToggle: {
                $lt: new Date(
                  Date.now() -
                    GAME_CONSTANTS.DRILLS.ACTIVE_STATE_TOGGLE_COOLDOWN * 1000,
                ),
              },
            },
          ],
        },
        {
          $set: {
            active: state,
            lastActiveStateToggle: new Date(),
          },
        },
        { new: true },
      );

      if (!updatedDrill) {
        throw new BadRequestException(
          `(toggleDrillActiveState) Either one of these errors occured: Drill not found, does not belong to operator, is a Basic Drill (non-toggleable) or has already been toggled in the last ${GAME_CONSTANTS.DRILLS.ACTIVE_STATE_TOGGLE_COOLDOWN / 60 / 60} hours.`,
        );
      }

      // Recalculate cumulativeEff for operator
      const drillAgg = await this.drillModel.aggregate([
        { $match: { operatorId, active: true } },
        {
          $group: {
            _id: '$operatorId',
            totalDrillEff: { $sum: '$actualEff' },
          },
        },
      ]);

      const totalDrillEff = drillAgg[0]?.totalDrillEff || 0;

      const effMultiplier = operator.effMultiplier || 1;
      const effCredits = operator.effCredits || 0;

      // Get a new luck factor for the operator
      const luckFactor =
        GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER +
        Math.random() *
          (GAME_CONSTANTS.LUCK.MAX_LUCK_MULTIPLIER -
            GAME_CONSTANTS.LUCK.MIN_LUCK_MULTIPLIER);

      this.logger.error(
        `(toggleDrillActiveState) Luck factor: ${luckFactor}, effMultiplier: ${effMultiplier}, effCredits: ${effCredits}, totalDrillEff: ${totalDrillEff}`,
      );

      const cumulativeEff =
        totalDrillEff * effMultiplier * luckFactor + effCredits;

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
        lastActiveStateToggle: null,
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
   * Converts an operator's equity to their effMultiplier value.
   */
  equityToEffMultiplier(equity: number): number {
    return 1 + Math.log(1 + 0.0000596 * equity);
  }
}
