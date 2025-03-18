import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { PoolOperatorService } from './pool-operator.service';
import { Types } from 'mongoose';

@Controller('pool-operators') // Base route: `/pool-controllers`
export class PoolOperatorController {
  constructor(private readonly poolOperatorService: PoolOperatorService) {}

  /**
   * POST `/create`
   * Creates a new pool operator.
   * Example: `{ operatorId: '123', poolId: '456' }`
   */
  @Post('/create')
  async createPoolOperator(
    @Body('operatorId') operatorId: string,
    @Body('poolId') poolId: string,
  ): Promise<ApiResponse<null>> {
    return this.poolOperatorService.createPoolOperator(
      new Types.ObjectId(operatorId),
      new Types.ObjectId(poolId),
    );
  }

  /**
   * DELETE `/`
   * Deletes a pool operator.
   * Example: `{ operatorId: '123' }`
   */
  @Delete('/')
  async deletePoolOperator(
    @Body('operatorId') operatorId: string,
  ): Promise<ApiResponse<null>> {
    return this.poolOperatorService.removePoolOperator(
      new Types.ObjectId(operatorId),
    );
  }
}
