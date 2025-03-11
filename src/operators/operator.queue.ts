import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';
import { Operator } from 'src/operators/schemas/operator.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Drill } from 'src/drills/schemas/drill.schema';
import { DrillVersion } from 'src/common/enums/drill.enum';
import { DrillService } from 'src/drills/drill.service';

@Injectable()
@Processor('operator-queue')
export class OperatorQueue implements OnModuleInit {
  private readonly logger = new Logger(OperatorQueue.name);
  private readonly sixHoursInMs = 6 * 60 * 60 * 1000; // 6 hours

  constructor(
    private readonly operatorWalletService: OperatorWalletService,
    private readonly drillService: DrillService,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    @InjectQueue('operator-queue') private readonly operatorQueue: Queue, // ✅ Inject Bull Queue
  ) {}

  /**
   * Called when the module initializes. Ensures asset equity updates are scheduled.
   */
  async onModuleInit() {
    this.logger.log(
      `⏳ (operatorQueue) Ensuring operator asset equity update job is scheduled...`,
    );

    // ✅ Check if the job is already scheduled
    const existingJobs = await this.operatorQueue.getRepeatableJobs();
    if (!existingJobs.some((job) => job.name === 'update-asset-equity')) {
      await this.operatorQueue.add(
        'update-asset-equity',
        {},
        { repeat: { every: this.sixHoursInMs } }, // ✅ Runs every 6 hours
      );
      this.logger.log(
        `✅ (operatorQueue) Scheduled asset equity update every 6 hours.`,
      );
    } else {
      this.logger.log(
        `🔄 (operatorQueue) Asset equity update job is already scheduled.`,
      );
    }
  }

  /**
   * Processes the asset equity update job.
   */
  @Process('update-asset-equity')
  async handleAssetEquityUpdate() {
    this.logger.log(
      `🔄 (update-asset-equity) Running scheduled asset equity update...`,
    );
    try {
      await this.updateWeightedAssetEquityRelatedData();
      this.logger.log(
        `✅ (update-asset-equity) Successfully updated weighted asset equity & effMultiplier.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ (update-asset-equity) Error updating asset equity: ${error.message}`,
      );
    }
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
      const effMultiplier =
        this.drillService.equityToEffMultiplier(newWeightedEquity);

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
}
