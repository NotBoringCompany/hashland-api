import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from './operator.service';
import { Operator } from './schemas/operator.schema';
import { Types } from 'mongoose';

@Controller('operator') // Base route: `/controller`
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  /**
   * GET `/`
   * Fetches an operator with optional field projection.
   * Example: `?projection=version,config`
   */
  @Get()
  async getOperatorData(
    @Query('operatorId') operatorId?: string,
    @Query('projection') projection?: string,
  ): Promise<ApiResponse<{ operator: Partial<Operator> }>> {
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
}
