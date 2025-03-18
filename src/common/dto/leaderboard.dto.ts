import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsPositive,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'The ranking position of the operator',
    example: 1,
  })
  rank: number;

  @ApiProperty({
    description: 'The username of the operator',
    example: 'hashland_champion',
  })
  username: string;

  @ApiProperty({
    description: 'The total amount of HASH earned by the operator',
    example: 5000,
  })
  earnedHASH: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({
    description: 'Array of leaderboard entries',
    type: [LeaderboardEntryDto],
  })
  leaderboard: LeaderboardEntryDto[];
}

export class GetLeaderboardQueryDto {
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
    example: 10,
    required: false,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class GetPoolLeaderboardQueryDto extends GetLeaderboardQueryDto {
  @ApiProperty({
    description: 'The ID of the pool to get the leaderboard for',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsString()
  poolId: string;
}
