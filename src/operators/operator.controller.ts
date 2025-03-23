import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from './operator.service';
import { Operator } from './schemas/operator.schema';
import { Types } from 'mongoose';
import { GetOperatorResponseDto } from 'src/common/dto/operator.dto';
import { OperatorWallet } from './schemas/operator-wallet.schema';
import { Drill } from 'src/drills/schemas/drill.schema';

@ApiTags('Operators')
@Controller('operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @ApiOperation({
    summary: 'Get operator data',
    description:
      'Fetches operator data, wallets, drills and pool information with optional field projection',
  })
  @ApiQuery({
    name: 'operatorId',
    description: 'The ID of the operator to retrieve',
    required: true,
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'projection',
    description:
      'Comma-separated list of fields to include in the response for the operator data',
    required: false,
    type: String,
    example: 'username,assetEquity,cumulativeEff',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved operator data',
    type: GetOperatorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Operator not found',
  })
  @Get()
  async getOperatorData(
    @Query('operatorId') operatorId?: string,
    @Query('projection') projection?: string,
  ): Promise<
    AppApiResponse<{
      operator: Partial<Operator>;
      wallets: Partial<OperatorWallet[]>;
      drills: Partial<Drill[]>;
      poolId?: Types.ObjectId;
    }>
  > {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.operatorService.fetchOperatorData(
      new Types.ObjectId(operatorId),
      projectionObj,
    );
  }

  @ApiOperation({
    summary: 'Get operator overview data',
    description:
      'Fetches overview data, including total number of operators, $HASH extracted by all operators, and so on',
  })
  @ApiQuery({
    name: 'operatorId',
    description: 'The ID of the operator to retrieve',
    required: true,
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved operator overview data',
  })
  @ApiResponse({
    status: 404,
    description: 'Operator not found',
  })
  @Get('overview')
  async getOverviewData(@Query('operatorId') operatorId?: string): Promise<
    AppApiResponse<{
      operator: Partial<Operator>;
      wallets: Partial<OperatorWallet[]>;
      drills: Partial<Drill[]>;
      poolId?: Types.ObjectId;
    }>
  > {
    return this.operatorService.fetchOperatorData(
      new Types.ObjectId(operatorId),
    );
  }
}
