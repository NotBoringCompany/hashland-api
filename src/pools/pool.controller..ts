import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PoolService } from './pool.service';
import { Pool } from './schemas/pool.schema';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { GetAllPoolsResponseDto } from 'src/common/dto/pools/pool.dto';

@ApiTags('Pools')
@Controller('pools') // Base route: `/pools`
export class PoolController {
  constructor(private readonly poolService: PoolService) {}

  @ApiOperation({
    summary: 'Get all pools',
    description: 'Fetches all pools with optional field projection',
  })
  @ApiQuery({
    name: 'projection',
    description: 'Comma-separated list of fields to include in the response',
    required: false,
    type: String,
    example: 'name,maxOperators',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pools',
    type: GetAllPoolsResponseDto,
  })
  @Get()
  async getAllPools(
    @Query('projection') projection?: string,
  ): Promise<AppApiResponse<{ pools: Partial<Pool[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.poolService.getAllPools(projectionObj);
  }
}
