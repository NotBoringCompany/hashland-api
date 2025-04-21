import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

/**
 * DTO representing a referred user
 */
export class ReferredUserDto {
  @ApiProperty({
    description: 'The ID of the referred user',
    example: '507f1f77bcf86cd799439011',
  })
  userId: Types.ObjectId;

  @ApiProperty({
    description: 'Username or display name of the referred user',
    example: 'crypto_miner42',
  })
  username: string;

  @ApiProperty({
    description: 'The date when the user was referred',
    example: '2023-05-15T10:30:00.000Z',
  })
  referredDate: Date;

  @ApiProperty({
    description: 'Whether rewards have been processed for this referral',
    example: true,
  })
  rewardsProcessed: boolean;

  constructor(data: {
    userId: Types.ObjectId;
    username: string;
    referredDate: Date;
    rewardsProcessed: boolean;
  }) {
    this.userId = data.userId;
    this.username = data.username;
    this.referredDate = data.referredDate;
    this.rewardsProcessed = data.rewardsProcessed;
  }
}

/**
 * DTO for the response when getting a list of referred users
 */
export class ReferredUsersResponseDto {
  @ApiProperty({
    description: 'List of users who were referred',
    type: [ReferredUserDto],
  })
  referredUsers: ReferredUserDto[];

  @ApiProperty({
    description: 'Total count of referred users',
    example: 5,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Maximum number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 1,
  })
  pages: number;

  constructor(data: {
    referredUsers: ReferredUserDto[];
    totalCount: number;
    page?: number;
    limit?: number;
    pages?: number;
  }) {
    this.referredUsers = data.referredUsers;
    this.totalCount = data.totalCount;
    this.page = data.page || 1;
    this.limit = data.limit || data.referredUsers.length;
    this.pages = data.pages || Math.ceil(data.totalCount / this.limit);
  }
}
