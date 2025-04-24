import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  IsNumber,
  IsDate,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

/**
 * DTO for rewards configuration
 */
export class RewardsDto {
  @ApiProperty({
    description: 'Efficiency credits reward amount',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  effCredits?: number;

  @ApiProperty({
    description: 'Hash bonus reward amount',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hashBonus?: number;
}

/**
 * DTO for creating a new starter code
 */
export class CreateStarterCodeDto {
  @ApiProperty({
    description: 'The operator ID creating this starter code (optional)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  createdBy?: string | Types.ObjectId;

  @ApiProperty({
    description:
      'Custom starter code (optional, will be auto-generated if not provided)',
    example: 'STARTER123',
    required: false,
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Rewards configuration for this starter code',
    type: RewardsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;

  @ApiProperty({
    description: 'Expiration date for this starter code (optional)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

/**
 * DTO for using a starter code
 */
export class UseStarterCodeDto {
  @ApiProperty({
    description: 'The starter code to use',
    example: 'STARTER123',
  })
  @IsNotEmpty()
  @IsString()
  starterCode: string;

  @ApiProperty({
    description: 'The operator ID using this starter code',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsMongoId()
  operatorId: string | Types.ObjectId;
}

/**
 * DTO for the response when getting or using a starter code
 */
export class StarterCodeResponseDto {
  @ApiProperty({
    description: 'The starter code',
    example: 'STARTER123',
  })
  code: string;

  @ApiProperty({
    description: 'Whether the code is valid and unused',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Rewards configuration for this starter code',
    example: {
      effCredits: 150,
      hashBonus: 75,
    },
    required: false,
  })
  rewards?: {
    effCredits?: number;
    hashBonus?: number;
  };

  constructor(data: {
    code: string;
    isValid: boolean;
    rewards?: { effCredits?: number; hashBonus?: number };
  }) {
    this.code = data.code;
    this.isValid = data.isValid;
    this.rewards = data.rewards;
  }
}
