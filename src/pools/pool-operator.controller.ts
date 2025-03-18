import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { PoolOperatorService } from './pool-operator.service';
import { Types } from 'mongoose';
import {
  CreatePoolOperatorDto,
  DeletePoolOperatorDto,
} from 'src/common/dto/pools/pool-operator.dto';

@ApiTags('Pool Operators')
@Controller('pool-operators') // Base route: `/pool-controllers`
export class PoolOperatorController {
  constructor(private readonly poolOperatorService: PoolOperatorService) {}

  @ApiOperation({
    summary: 'Create a pool operator',
    description: 'Creates a new pool operator by linking an operator to a pool',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully created pool operator',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Operator is already in a pool or pool is full',
  })
  @ApiResponse({
    status: 404,
    description: 'Pool not found',
  })
  @Post('/create')
  async createPoolOperator(
    @Body() createPoolOperatorDto: CreatePoolOperatorDto,
  ): Promise<AppApiResponse<null>> {
    return this.poolOperatorService.createPoolOperator(
      new Types.ObjectId(createPoolOperatorDto.operatorId),
      new Types.ObjectId(createPoolOperatorDto.poolId),
    );
  }

  @ApiOperation({
    summary: 'Delete a pool operator',
    description: 'Removes an operator from their current pool',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully removed operator from pool',
  })
  @ApiResponse({
    status: 404,
    description: 'Pool operator not found',
  })
  @Delete('/')
  async deletePoolOperator(
    @Body() deletePoolOperatorDto: DeletePoolOperatorDto,
  ): Promise<AppApiResponse<null>> {
    return this.poolOperatorService.removePoolOperator(
      new Types.ObjectId(deletePoolOperatorDto.operatorId),
    );
  }
}
