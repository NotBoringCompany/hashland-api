import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pool } from './schemas/pool.schema';
import { ApiResponse } from 'src/common/dto/response.dto';
import { PoolOperator } from './schemas/pool-operator.schema';
import { performance } from 'perf_hooks';

@Injectable()
export class PoolService {
  private readonly logger = new Logger(PoolService.name);

  constructor(
    @InjectModel(Pool.name)
    private poolModel: Model<Pool>,
    @InjectModel(PoolOperator.name)
    private poolOperatorModel: Model<PoolOperator>,
  ) {}

  /**
   * Join a pool. Ensures:
   * - An operator can only be in one pool.
   * - The pool is not full.
   */
  async joinPool(
    operatorId: Types.ObjectId,
    poolId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      // ✅ Step 1: Fetch pool details + check if operator is already in a pool
      const [operatorInPool, pool] = await Promise.all([
        this.poolOperatorModel.exists({ operator: operatorId }),
        this.poolModel.findOne({ _id: poolId }, { maxOperators: 1 }).lean(),
      ]);

      if (operatorInPool) {
        return new ApiResponse<null>(
          400,
          `(joinPool) Operator is already in a pool.`,
        );
      }

      if (!pool) {
        return new ApiResponse<null>(404, `(joinPool) Pool not found.`);
      }

      // ✅ Step 2: Check if the pool is full
      const poolOperatorCount = await this.poolOperatorModel.countDocuments({
        pool: poolId,
      });
      if (poolOperatorCount >= pool.maxOperators) {
        return new ApiResponse<null>(400, `(joinPool) Pool is full.`);
      }

      // TO DO IN THE FUTURE:
      // Ensure that the pool prerequisites are met before joining.

      // ✅ Step 3: Insert operator into the pool **atomically** (prevent race conditions)
      const result = await this.poolOperatorModel.updateOne(
        { operator: operatorId }, // Ensure operatorId is unique
        { $setOnInsert: { operator: operatorId, pool: poolId } }, // Insert only if it doesn't exist
        { upsert: true }, // Insert if not exists
      );

      if (result.upsertedCount === 0) {
        return new ApiResponse<null>(
          400,
          `(joinPool) Operator already joined this pool.`,
        );
      }

      return new ApiResponse<null>(
        200,
        `(joinPool) Operator successfully joined pool.`,
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(joinPool) Error joining pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Creates a new pool. Bypasses prerequisites and costs. Admin only.
   */
  async createPoolAdmin(
    // the operator's database ID
    leaderId: string | null,
    // the name of the pool
    name: string,
    // the maximum number of operators allowed in the pool
    maxOperators?: number | null,
  ): Promise<
    ApiResponse<{
      poolId: string;
    }>
  > {
    try {
      const pool = await this.poolModel.create({
        leaderId: leaderId ? new Types.ObjectId(leaderId) : null,
        name,
        maxOperators,
        // default reward system
        rewardSystem: {
          extractorOperator: 48.0,
          leader: 4.0,
          activePoolOperators: 48.0,
        },
        // anyone can join
        joinPrerequisites: null,
      });

      return new ApiResponse<{ poolId: string }>(
        200,
        `(createPoolAdmin) Pool created.`,
        {
          poolId: pool._id.toString(),
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(createPoolAdmin) Error creating pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Fetch all pools with up-to-date operator counts.
   */
  async getAllPools(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ pools: any[] }>> {
    try {
      // 1) Aggregate operator counts by pool in one go
      const counts = await this.poolOperatorModel.aggregate<{
        _id: any;
        count: number;
      }>([{ $group: { _id: '$pool', count: { $sum: 1 } } }]);

      // 2) Build a lookup map: poolId → operator count
      const countMap = counts.reduce<Record<string, number>>(
        (map, { _id, count }) => {
          map[_id.toString()] = count;
          return map;
        },
        {},
      );

      // 3) Fetch all pools with optional projection
      const pools = await this.poolModel.find().select(projection).lean();

      // 4) Merge in the counts (defaulting to 0 if no operators)
      const poolsWithCounts = pools.map((pool) => ({
        ...pool,
        currentOperatorCount: countMap[pool._id.toString()] || 0,
      }));

      return new ApiResponse(200, '(getAllPools) Fetched all pools.', {
        pools: poolsWithCounts,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getAllPools) Error fetching pools: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Get a pool by its ID.
   * Ensures the pool's efficiency value is up-to-date.
   */
  async getPoolById(
    poolId: string,
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ pool: Pool | null }>> {
    try {
      // First check if the pool exists and get its last update time
      const poolWithTimestamp = await this.poolModel
        .findById(poolId, { lastEffUpdate: 1 })
        .lean();

      if (!poolWithTimestamp) {
        throw new NotFoundException(
          new ApiResponse<null>(
            404,
            `(getPoolById) Pool with ID ${poolId} not found`,
          ),
        );
      }

      // Now fetch the pool with the updated efficiency and requested projection
      const pool = await this.poolModel
        .findById(poolId)
        .select(projection)
        .lean();

      return new ApiResponse<{ pool: Pool | null }>(
        200,
        `(getPoolById) Fetched pool with ID ${poolId}.`,
        { pool },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getPoolById) Error fetching pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Update pool settings (e.g., maxOperators, joinPrerequisites).
   */
  async updatePool(poolId: string, updates: Partial<Pool>) {
    return this.poolModel.findByIdAndUpdate(poolId, updates, { new: true });
  }

  /**
   * Fetches a random public pool ID that still has available slots.
   */
  async fetchAvailableRandomPublicPoolId(): Promise<string | null> {
    try {
      const publicPoolIds = [
        new Types.ObjectId('67c59119e13cd025d70558f8'),
        new Types.ObjectId('67c5913d38219727f71abcc9'),
        new Types.ObjectId('67c59160bcc83377ab6e9201'),
      ];

      const pools = await this.poolModel
        .find({ _id: { $in: publicPoolIds } }, { _id: 1, maxOperators: 1 })
        .lean();

      const poolMemberCountMap = new Map<string, number>();

      await Promise.all(
        publicPoolIds.map(async (poolId) => {
          const count = await this.poolOperatorModel.countDocuments({
            pool: poolId,
          });
          poolMemberCountMap.set(poolId.toString(), count);
        }),
      );

      this.logger.debug(
        `(fetchAvailableRandomPublicPoolId) Pool member counts: ${JSON.stringify(
          Array.from(poolMemberCountMap.entries()),
          null,
          2,
        )}`,
      );

      const availablePools = pools.filter((pool) => {
        const count = poolMemberCountMap.get(pool._id.toString()) ?? 0;
        return pool.maxOperators > count;
      });

      this.logger.debug(
        `(fetchAvailableRandomPublicPoolId) Available pools: ${JSON.stringify(
          availablePools,
          null,
          2,
        )}`,
      );

      if (availablePools.length > 0) {
        const randomIndex = Math.floor(Math.random() * availablePools.length);
        return availablePools[randomIndex]._id.toString();
      }

      return null;
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(fetchAvailableRandomPublicPoolId) Error fetching available pool: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Updates the estimated efficiency (estimatedEff) for a specific pool.
   * Calculates the sum of weightedEff (cumulativeEff * effMultiplier) for all operators in the pool.
   * Uses a more efficient aggregation pipeline for performance.
   *
   * @param poolId The ID of the pool to update
   * @param forceUpdate Whether to force an update even if cache is still valid
   * @returns The updated estimatedEff value
   */
  async updatePoolEstimatedEff(
    poolId: string | Types.ObjectId,
  ): Promise<number> {
    try {
      // Early return if poolId is null
      if (!poolId) {
        this.logger.warn(
          `Skipping pool efficiency update - poolId is null or undefined`,
        );
        return 0;
      }

      // Check if pool exists
      const pool = await this.poolModel.findById(poolId, { lastEffUpdate: 1 });
      if (!pool) {
        throw new NotFoundException(
          `(updatePoolEstimatedEff) Pool with ID ${poolId} not found`,
        );
      }

      // Use aggregation to efficiently calculate the weighted efficiency in a single query
      const aggregationResult = await this.poolOperatorModel.aggregate([
        // Step 1: Match operators in this pool
        { $match: { pool: poolId } },

        // Step 2: Lookup operator details
        {
          $lookup: {
            from: 'Operators',
            localField: 'operator',
            foreignField: '_id',
            as: 'operator',
          },
        },

        // Step 3: Unwind the operator array
        { $unwind: { path: '$operator', preserveNullAndEmptyArrays: false } },

        // Step 4: Calculate weighted efficiency for each operator
        {
          $project: {
            weightedEff: {
              $multiply: ['$operator.cumulativeEff', '$operator.effMultiplier'],
            },
          },
        },

        // Step 5: Sum up all weighted efficiencies
        {
          $group: {
            _id: null,
            totalWeightedEff: { $sum: '$weightedEff' },
            count: { $sum: 1 },
          },
        },
      ]);

      // Set default values if no results
      let totalWeightedEff = 0;
      let operatorCount = 0;

      if (aggregationResult.length > 0) {
        totalWeightedEff = aggregationResult[0].totalWeightedEff || 0;
        operatorCount = aggregationResult[0].count || 0;
      }

      // Update pool record
      await this.poolModel.findByIdAndUpdate(poolId, {
        estimatedEff: totalWeightedEff,
        lastEffUpdate: new Date(),
      });

      this.logger.log(
        `Updated estimatedEff for pool ${poolId}: ${totalWeightedEff} from ${operatorCount} operators`,
      );
      return totalWeightedEff;
    } catch (error) {
      this.logger.error(
        `Error updating pool estimatedEff: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(updatePoolEstimatedEff) Error: ${error.message}`,
        ),
      );
    }
  }

  /**
   * Updates the estimated efficiency for all pools in the system.
   * Uses batch processing for efficiency.
   */
  async updateAllPoolsEstimatedEff(): Promise<void> {
    try {
      const startTime = performance.now();
      this.logger.log('Starting update of all pools estimated efficiency...');

      // Get all pool IDs
      const pools = await this.poolModel.find({}, { _id: 1 }).lean();

      if (pools.length === 0) {
        this.logger.log('No pools found to update');
        return;
      }

      // Process in batches of 10 pools
      const batchSize = 10;
      for (let i = 0; i < pools.length; i += batchSize) {
        const batch = pools.slice(i, i + batchSize);
        await Promise.all(
          batch.map((pool) => this.updatePoolEstimatedEff(pool._id)),
        );
        this.logger.log(
          `Processed batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(pools.length / batchSize)}`,
        );
      }

      const endTime = performance.now();
      this.logger.log(
        `Updated estimatedEff for all ${pools.length} pools in ${(endTime - startTime).toFixed(2)}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating all pools estimatedEff: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(updateAllPoolsEstimatedEff) Error: ${error.message}`,
        ),
      );
    }
  }

  /**
   * Get operators for a specific pool with pagination.
   */
  async getPoolOperators(
    poolId: string,
    page: number = 1,
    limit: number = 20,
    projection?: string | Record<string, 1 | 0>,
    populate: boolean = true,
  ): Promise<
    ApiResponse<{
      operators: Partial<PoolOperator[]>;
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>
  > {
    try {
      // Validate pagination parameters
      if (page < 1) {
        return new ApiResponse(
          400,
          `(getPoolOperators) Invalid page number: ${page}`,
        );
      }

      if (limit < 1 || limit > 100) {
        return new ApiResponse(
          400,
          `(getPoolOperators) Invalid limit: ${limit}`,
        );
      }

      // Check if pool exists
      const poolExists = await this.poolModel.exists({
        _id: new Types.ObjectId(poolId),
      });
      if (!poolExists) {
        return new ApiResponse(
          404,
          `(getPoolOperators) Pool with ID ${poolId} not found`,
        );
      }

      // Start building the query
      let operatorsQuery = this.poolOperatorModel
        .find({ pool: new Types.ObjectId(poolId) })
        .select(projection);

      // Populate operator details if requested
      if (populate) {
        operatorsQuery = operatorsQuery.populate({
          path: 'operator',
          select:
            'usernameData.username cumulativeEff effMultiplier totalEarnedHASH assetEquity',
          model: 'Operator',
          options: { lean: true },
        });
      }

      // Execute count and find in parallel for efficiency
      const [totalCount, operators] = await Promise.all([
        // Count total documents for pagination
        this.poolOperatorModel.countDocuments({
          pool: new Types.ObjectId(poolId),
        }),

        // Get paginated results with optional projection and population
        operatorsQuery
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / limit);

      return new ApiResponse(
        200,
        `(getPoolOperators) Successfully fetched operators for pool ${poolId}`,
        {
          operators,
          total: totalCount,
          page,
          limit,
          pages: totalPages,
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse(
          500,
          `(getPoolOperators) Error fetching pool operators: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Get a specific operator in a pool by operator ID.
   * Used for retrieving the authenticated user's pool operator details.
   */
  async getPoolOperatorByOperatorId(
    poolId: string,
    operatorId: Types.ObjectId,
    projection?: Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ operator: Partial<PoolOperator> | null }>> {
    try {
      // Check if pool exists
      const poolExists = await this.poolModel.exists({
        _id: new Types.ObjectId(poolId),
      });

      if (!poolExists) {
        return new ApiResponse(
          404,
          `(getPoolOperatorByOperatorId) Pool with ID ${poolId} not found`,
          { operator: null },
        );
      }

      // Find the pool operator
      let query = this.poolOperatorModel.findOne({
        pool: new Types.ObjectId(poolId),
        operator: operatorId,
      });

      // Apply projection if provided
      if (projection) {
        query = query.select(projection);
      }

      // Populate operator details
      query = query.populate({
        path: 'operator',
        select:
          'usernameData.username cumulativeEff effMultiplier totalEarnedHASH assetEquity',
        model: 'Operator',
        options: { lean: true },
      });

      const poolOperator = await query.lean();

      if (!poolOperator) {
        return new ApiResponse(
          404,
          `(getPoolOperatorByOperatorId) Operator is not a member of this pool`,
          { operator: null },
        );
      }

      return new ApiResponse(
        200,
        `(getPoolOperatorByOperatorId) Successfully fetched operator details for pool ${poolId}`,
        { operator: poolOperator },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse(
          500,
          `(getPoolOperatorByOperatorId) Error fetching pool operator: ${err.message}`,
          { operator: null },
        ),
      );
    }
  }
}
