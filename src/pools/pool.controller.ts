import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PoolService } from './pool.service';
import { Pool } from './schemas/pool.schema';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { GetAllPoolsResponseDto } from 'src/common/dto/pools/pool.dto';
import {
  GetPoolOperatorsQueryDto,
  GetPoolOperatorsResponseDto,
  GetPoolOperatorResponseDto,
} from 'src/common/dto/pools/pool-operator.dto';
import { PoolOperator } from './schemas/pool-operator.schema';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { Types } from 'mongoose';

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
  @ApiQuery({
    name: 'updateStaleEff',
    description: 'Whether to update stale efficiency values (default: true)',
    required: false,
    type: Boolean,
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
  @ApiQuery({
    name: 'updateStaleEff',
    description: 'Whether to update stale efficiency value (default: true)',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pool',
  })
  @Get(':id')
  async getPoolById(
    @Param('id') id: string,
    @Query('projection') projection?: string,
    @Query('updateStaleEff') updateStaleEff?: string,
  ): Promise<AppApiResponse<{ pool: Pool | null }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    // Parse the updateStaleEff parameter
    const shouldUpdateStaleEff =
      updateStaleEff === undefined ? true : updateStaleEff === 'true';

    return this.poolService.getPoolById(
      id,
      projectionObj,
      shouldUpdateStaleEff,
    );
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

  @ApiOperation({
    summary: 'Get current user pool operator details',
    description:
      'Fetches the details of the authenticated user in the specified pool',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the pool',
    type: String,
  })
  @ApiQuery({
    name: 'projection',
    description: 'Comma-separated list of fields to include in the response',
    required: false,
    type: String,
    example: 'operator,totalRewards',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved pool operator details',
    type: GetPoolOperatorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Pool or operator not found',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/operators/me')
  async getOwnPoolOperator(
    @Param('id') poolId: string,
    @Query('projection') projection?: string,
    @Request() req?: any,
  ): Promise<AppApiResponse<{ operator: Partial<PoolOperator> | null }>> {
    const operatorId = new Types.ObjectId(req.user.operatorId);

    // Convert query string to Mongoose projection object if provided
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.poolService.getPoolOperatorByOperatorId(
      poolId,
      operatorId,
      projectionObj,
    );
  }
}
