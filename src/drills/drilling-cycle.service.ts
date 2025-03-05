// import { Injectable } from '@nestjs/common';
// import { ExtractorSelectionService } from './services/extractor-selection.service';
// import { SchedulerBridgeService } from 'src/websocket/services/scheduler-bridge.service';

// @Injectable()
// export class DrillingCycleService {
//   constructor(
//     private readonly extractorSelectionService: ExtractorSelectionService,
//     private readonly schedulerBridgeService: SchedulerBridgeService,
//   ) {}

//   async completeCycle(cycleId: string) {
//     // Select extractor at the end of the cycle
//     await this.extractorSelectionService.selectExtractorForCycle(cycleId);

//     // Get cycle completion data
//     const cycleData = await this.getCycleCompletionData(cycleId);

//     // Send notifications about cycle completion
//     this.schedulerBridgeService.processCycleCompletion(cycleData);
//   }

//   private async getCycleCompletionData(cycleId: string) {
//     // This is a placeholder - implement your actual data retrieval logic
//     return {
//       cycleId,
//       timestamp: Math.floor(Date.now() / 1000),
//       totalHashMined: 1000000, // Example value
//       topMiners: [
//         { operatorId: 'operator-1', hashMined: 50000 },
//         { operatorId: 'operator-2', hashMined: 40000 },
//         { operatorId: 'operator-3', hashMined: 30000 },
//         { operatorId: 'operator-4', hashMined: 20000 },
//         { operatorId: 'operator-5', hashMined: 10000 },
//       ],
//     };
//   }
// }

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DrillingCycle } from './schemas/drilling-cycle.schema';
import { RedisService } from 'src/common/redis.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { ApiResponse } from 'src/common/dto/response.dto';

@Injectable()
export class DrillingCycleService {
  private readonly logger = new Logger(DrillingCycleService.name);
  private readonly redisCycleKey = 'drilling-cycle:current';
  private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000; // Convert to ms

  constructor(
    @InjectModel(DrillingCycle.name)
    private drillingCycleModel: Model<DrillingCycle>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Initializes the cycle number in Redis if not already set.
   */
  async initializeCycleNumber() {
    const cycleNumber = await this.redisService.get(this.redisCycleKey);

    if (!cycleNumber) {
      const latestCycle = await this.drillingCycleModel
        .findOne()
        .sort({ cycleNumber: -1 })
        .exec();
      const newCycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;

      await this.redisService.set(
        this.redisCycleKey,
        newCycleNumber.toString(),
      );
      this.logger.log(`🔄 Redis Cycle Number Initialized: ${newCycleNumber}`);
    }
  }

  /**
   * Creates a new drilling cycle.
   */
  async createDrillingCycle(): Promise<number> {
    const newCycleNumber = await this.redisService.increment(
      this.redisCycleKey,
      1,
    );
    const now = new Date();

    this.logger.log(`🛠 Creating Drilling Cycle: #${newCycleNumber}...`);

    try {
      const cycle = await this.drillingCycleModel.create({
        cycleNumber: newCycleNumber,
        startTime: now,
        endTime: new Date(now.getTime() + this.cycleDuration),
      });

      this.logger.log(`✅ New Drilling Cycle Created: #${cycle.cycleNumber}`);
      return newCycleNumber;
    } catch (error) {
      this.logger.error(`❌ Error Creating Drilling Cycle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetches the latest drilling cycle number from Redis.
   */
  async getCurrentCycleNumber(): Promise<
    ApiResponse<{
      cycleNumber: number;
    }>
  > {
    const cycle = await this.redisService.get(this.redisCycleKey);
    // return cycle ? parseInt(cycle, 10) : 0;
    return new ApiResponse<{
      cycleNumber: number;
    }>(200, `(getCurrentCycleNumber) Fetched.`, {
      cycleNumber: cycle ? parseInt(cycle, 10) : 0,
    });
  }

  /**
   * Resets the cycle number in Redis (only if required, for example for debugging/testing).
   */
  async resetCycleNumber(
    newCycleNumber: number,
    password: string,
  ): Promise<ApiResponse<null>> {
    if (password !== process.env.ADMIN_PASSWORD) {
      return new ApiResponse<null>(
        403,
        `(resetCycleNumber) Invalid password provided. Cycle number not reset.`,
      );
    }

    try {
      await this.redisService.set(
        this.redisCycleKey,
        newCycleNumber.toString(),
      );
      this.logger.warn(`🔄 Drilling Cycle Number Reset to: ${newCycleNumber}`);

      return new ApiResponse<null>(
        200,
        `(resetCycleNumber) Cycle number reset to ${newCycleNumber}.`,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(resetCycleNumber) Error resetting cycle number: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Returns the current status of the drilling cycle (either enabled or disabled).
   */
  async getCycleStatus(): Promise<
    ApiResponse<{
      cycleEnabled: boolean;
    }>
  > {
    return new ApiResponse<{ cycleEnabled: boolean }>(
      200,
      `(getCycleStatus) Cycle status fetched.`,
      { cycleEnabled: GAME_CONSTANTS.CYCLES.ENABLED },
    );
  }

  /**
   * Toggles the creation of new drilling cycles on or off.
   */
  toggleCycle(enabled: boolean, password: string): ApiResponse<null> {
    if (password !== process.env.ADMIN_PASSWORD) {
      return new ApiResponse<null>(
        403,
        `(toggleCycle) Invalid password provided. Cycle state not changed.`,
      );
    }

    GAME_CONSTANTS.CYCLES.ENABLED = enabled;
    this.logger.log(
      `🔄 Drilling Cycles ${enabled ? 'Enabled' : 'Disabled'} by password.`,
    );
    return new ApiResponse<null>(
      200,
      `(toggleCycle) Drilling Cycles are now ${enabled ? 'enabled' : 'disabled'}.`,
    );
  }
}
