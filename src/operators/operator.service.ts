import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Operator } from './schemas/operator.schema';
import { PoolOperatorService } from 'src/pools/pool-operator.service';
import { PoolService } from 'src/pools/pool.service';
import { DrillingSession } from 'src/drills/schemas/drilling-session.schema';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
    private readonly poolOperatorService: PoolOperatorService,
    private readonly poolService: PoolService,
  ) {}

  /**
   * Depletes fuel for active operators (i.e. operators that have an active drilling session)
   * and replenishes fuel for inactive operators (i.e. operators that do not have an active drilling session).
   */
  async processFuelForAllOperators() {
    const startTime = performance.now(); // ⏳ Start timing

    const activeOperatorIds = await this.fetchActiveOperatorIds();

    // Generate a random depletion/replenishment value
    const fuelUsed = this.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
    );

    const fuelGained = this.getRandomFuelValue(
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.minUnits,
      GAME_CONSTANTS.FUEL.BASE_FUEL_REGENERATION_RATE.maxUnits,
    );

    // 🛠 Bulk update ACTIVE operators (deplete fuel)
    await this.operatorModel.updateMany(
      { _id: { $in: Array.from(activeOperatorIds) } }, // Only active operators
      { $inc: { currentFuel: -fuelUsed } },
    );

    // 🛠 Bulk update INACTIVE operators (replenish fuel)
    await this.operatorModel.updateMany(
      {
        _id: { $nin: Array.from(activeOperatorIds) }, // Only inactive operators
        $expr: { $lt: ['$currentFuel', '$maxFuel'] }, // ✅ Exclude those already at max fuel
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

    // **🔴 NEW: Stop drilling sessions for operators who drop below threshold**
    await this.drillingSessionModel.updateMany(
      {
        operatorId: { $in: Array.from(activeOperatorIds) },
        endTime: null, // ✅ Only stop sessions that are still running
        currentFuel: {
          $lt: GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits,
        }, // ✅ Below depletion threshold
      },
      { $set: { endTime: new Date() } }, // ✅ Mark session as ended
    );

    const endTime = performance.now(); // ⏳ End timing
    const executionTime = (endTime - startTime).toFixed(2);

    this.logger.log(
      `⚡ Fuel Processing Completed: 
     ⛏ Depleted ${fuelUsed} for ${activeOperatorIds.size} active operators.
     🔋 Replenished up to ${fuelGained} for inactive operators.
     🛑 Stopped drilling sessions for operators who dropped below fuel threshold.
     ⏱ Execution Time: ${executionTime}ms`,
    );
  }

  /**
   * Fetches the IDs of operators who currently have an active `DrillingSession` instance.
   */
  private async fetchActiveOperatorIds(): Promise<Set<Types.ObjectId>> {
    const activeSessions = await this.drillingSessionModel
      .find({ endTime: null })
      .select('operatorId')
      .lean();
    return new Set(activeSessions.map((session) => session.operatorId));
  }

  /**
   * Generates a random fuel value between `min` and `max`.
   */
  private getRandomFuelValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    const operator = await this.operatorModel.findOne({
      'tgProfile.tgId': id,
    });

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

    this.logger.log(
      `🆕(findOrCreateOperator) Created new operator: ${username}`,
    );
    return operator;
  }
}

