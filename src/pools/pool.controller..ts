import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PoolService } from './pool.service';
import { Pool } from './schemas/pool.schema';
import { ApiResponse } from 'src/common/dto/response.dto';
import { Types } from 'mongoose';

@Controller('pools') // Base route: `/pools`
export class PoolController {
  constructor(private readonly poolService: PoolService) {}

  /**
   * POST `/join`
   * ✅ Joins a pool.
   * Example: `{ "operatorId": "123", "poolId": "456" }`
   */
  @Post()
  async joinPool(
    @Body('operatorId') operatorId: string,
    @Body('poolId') poolId: string,
  ): Promise<ApiResponse<null>> {
    return this.poolService.joinPool(
      new Types.ObjectId(operatorId),
      new Types.ObjectId(poolId),
    );
  }

  /**
   * GET `/pools`
   * ✅ Fetches all pools with optional field projection.
   * Example: `/pools?projection=name,maxOperators`
   */
  @Get()
  async getAllPools(
    @Query('projection') projection?: string,
  ): Promise<ApiResponse<{ pools: Partial<Pool[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.poolService.getAllPools(projectionObj);
  }
}
