import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IsNumber, IsOptional, IsPositive, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PoolOperator } from 'src/pools/schemas/pool-operator.schema';

export class CreatePoolOperatorDto {
  @ApiProperty({
    description: 'The database ID of the operator who wants to join the pool',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({
    description: 'The database ID of the pool to join',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  @IsNotEmpty()
  poolId: string;
}

export class OperatorInfoDto {
  @ApiProperty({
    description: 'The operator ID',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'The username of the operator',
    example: 'hashdriller42',
  })
  username: string;

  @ApiProperty({
    description: 'The cumulative efficiency of the operator',
    example: 12345,
  })
  cumulativeEff: number;

  @ApiProperty({
    description: 'The efficiency multiplier of the operator',
    example: 1.25,
  })
  effMultiplier: number;
}

export class PoolOperatorWithInfoDto extends PoolOperator {
  @ApiProperty({
    description: 'The operator details',
    type: OperatorInfoDto,
  })
  operator: OperatorInfoDto;
}

export class GetPoolOperatorsResponseDto {
  @ApiProperty({
    description: 'Array of pool operators with operator information',
    type: [PoolOperatorWithInfoDto],
  })
  operators: Partial<PoolOperatorWithInfoDto[]>;

  @ApiProperty({
    description: 'Total count of pool operators',
    example: 125,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 7,
  })
  pages: number;
}

export class GetPoolOperatorsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination (starting from 1)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page (max 100)',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    description: 'Comma-separated list of fields to include in the response',
    required: false,
    example: 'operatorId,totalRewards',
  })
  @IsString()
  @IsOptional()
  projection?: string;

  @ApiProperty({
    description: 'Whether to populate the operator details',
    required: false,
    default: true,
    type: Boolean,
  })
  @IsOptional()
  @Type(() => Boolean)
  populate?: boolean;
}
