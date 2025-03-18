import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { Pool } from 'src/pools/schemas/pool.schema';

export class GetAllPoolsResponseDto {
  @ApiProperty({
    description: 'Array of pools',
    type: [Pool],
  })
  pools: Partial<Pool>[];
}

export class CreatePoolAdminDto {
  @ApiProperty({
    description: 'The database ID of the pool leader (operator)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsString()
  @IsOptional()
  leaderId?: string | null;

  @ApiProperty({
    description: 'The name of the pool',
    example: 'hashland-pool',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The maximum number of operators allowed in the pool',
    example: 10,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxOperators?: number | null;
}
