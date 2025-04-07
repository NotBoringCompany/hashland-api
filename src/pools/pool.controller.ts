import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PoolService } from './pool.service';
import { Pool } from './schemas/pool.schema';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { GetAllPoolsResponseDto } from 'src/common/dto/pools/pool.dto';
import {
  GetPoolOperatorsQueryDto,
  GetPoolOperatorsResponseDto,
} from 'src/common/dto/pools/pool-operator.dto';
import { PoolOperator } from './schemas/pool-operator.schema';

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

  @ApiOperation({
    summary: 'Get a pool by ID',
    description:
      'Fetches a specific pool by its ID with optional field projection',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the pool to fetch',
    type: String,
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
    description: 'Successfully retrieved pool',
  })
  @Get(':id')
  async getPoolById(
    @Param('id') id: string,
    @Query('projection') projection?: string,
  ): Promise<AppApiResponse<{ pool: Pool | null }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.poolService.getPoolById(id, projectionObj);
  }

  @ApiOperation({
    summary: 'Get operators for a specific pool',
    description:
      'Fetches a paginated list of operators that have joined a specific pool',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the pool',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pool operators',
    type: GetPoolOperatorsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid pagination parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Pool not found',
  })
  @Get(':id/operators')
  async getPoolOperators(
    @Param('id') id: string,
    @Query() query: GetPoolOperatorsQueryDto,
  ): Promise<
    AppApiResponse<{
      operators: Partial<PoolOperator[]>;
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>
  > {
    // Convert query string to Mongoose projection object if provided
    const projectionObj = query.projection
      ? query.projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.poolService.getPoolOperators(
      id,
      query.page || 1,
      query.limit || 20,
      projectionObj,
      query.populate !== false, // Default to true if not specified
    );
  }
}
