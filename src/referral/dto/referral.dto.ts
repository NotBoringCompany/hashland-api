import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

/**
 * DTO for generating a referral code for an operator
 */
export class GenerateReferralCodeDto {
  @ApiProperty({
    description: 'The operator ID to generate a referral code for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsMongoId()
  operatorId: string | Types.ObjectId;
}

/**
 * DTO for processing a referral
 */
export class ProcessReferralDto {
  @ApiProperty({
    description: 'The referral code used',
    example: 'ABC123XY',
  })
  @IsNotEmpty()
  @IsString()
  referralCode: string;

  @ApiProperty({
    description: 'The operator ID of the referred user',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsMongoId()
  newOperatorId: string | Types.ObjectId;
}

/**
 * DTO for the response when getting a referral code
 */
export class ReferralCodeResponseDto {
  @ApiProperty({
    description: 'The referral code',
    example: 'ABC123XY',
  })
  referralCode: string;

  @ApiProperty({
    description: 'Whether the code was newly generated',
    example: true,
  })
  isNew: boolean;

  constructor(data: { referralCode: string; isNew: boolean }) {
    this.referralCode = data.referralCode;
    this.isNew = data.isNew;
  }
}

/**
 * DTO for the response when getting referral stats
 */
export class ReferralStatsResponseDto {
  @ApiProperty({
    description: 'The referral code',
    example: 'ABC123XY',
  })
  referralCode: string;

  @ApiProperty({
    description: 'Total number of referrals',
    example: 5,
  })
  totalReferrals: number;

  @ApiProperty({
    description: 'Rewards earned from referrals',
    example: {
      effCredits: 125,
      hashBonus: 0,
    },
  })
  rewards: {
    effCredits: number;
    hashBonus: number;
  };

  constructor(data: {
    referralCode: string;
    totalReferrals: number;
    rewards: { effCredits: number; hashBonus: number };
  }) {
    this.referralCode = data.referralCode;
    this.totalReferrals = data.totalReferrals;
    this.rewards = data.rewards;
  }
}
