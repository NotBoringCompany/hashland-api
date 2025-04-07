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

export class GetPoolOperatorsResponseDto {
  @ApiProperty({
    description: 'Array of pool operators',
    type: [PoolOperator],
  })
  operators: Partial<PoolOperator[]>;

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
}
