import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from './operator.service';
import { Operator } from './schemas/operator.schema';
import { Types } from 'mongoose';
import { GetOperatorResponseDto } from 'src/common/dto/operator.dto';
import { OperatorWallet } from './schemas/operator-wallet.schema';
import { Drill } from 'src/drills/schemas/drill.schema';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';

@ApiTags('Operators')
@Controller('operators')
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
    example: 'usernameData.username,assetEquity,cumulativeEff',
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getOperatorData(
    @Request() req,
    @Query('projection') projection?: string,
  ): Promise<
    AppApiResponse<{
      operator: Partial<Operator>;
      wallets: Partial<OperatorWallet[]>;
      drills: Partial<Drill[]>;
      poolId?: Types.ObjectId;
    }>
  > {
    const operatorId = new Types.ObjectId(req.user.operatorId);

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
      assetEquity: number;
      totalOperators: number;
      totalHASHExtracted: number;
      totalHASHReserve: number;
    }>
  > {
    return this.operatorService.fetchOverviewData(
      new Types.ObjectId(operatorId),
    );
  }
}
