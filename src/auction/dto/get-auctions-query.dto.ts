import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsString,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuctionStatus } from '../schemas/auction.schema';

/**
 * DTO for querying auctions with pagination and filtering
 */
export class GetAuctionsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by auction status',
    enum: AuctionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;

  @ApiProperty({
    description: 'Filter by NFT ID',
    example: '507f1f77bcf86cd799439012',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  nftId?: string;

  @ApiProperty({
    description: 'Filter by current winner operator ID',
    example: '507f1f77bcf86cd799439013',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  currentWinner?: string;

  @ApiProperty({
    description: 'Search in auction title (case-insensitive)',
    example: 'rare artwork',
    required: false,
  })
  @IsOptional()
  @IsString()
  titleSearch?: string;

  @ApiProperty({
    description: 'Search in auction description (case-insensitive)',
    example: 'digital art',
    required: false,
  })
  @IsOptional()
  @IsString()
  descriptionSearch?: string;

  @ApiProperty({
    description: 'Minimum starting price filter',
    example: 100,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStartingPrice?: number;

  @ApiProperty({
    description: 'Maximum starting price filter',
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStartingPrice?: number;

  @ApiProperty({
    description: 'Minimum current highest bid filter',
    example: 150,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCurrentBid?: number;

  @ApiProperty({
    description: 'Maximum current highest bid filter',
    example: 2000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCurrentBid?: number;

  @ApiProperty({
    description: 'Filter auctions starting after this date',
    example: '2024-03-19T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  auctionStartAfter?: string;

  @ApiProperty({
    description: 'Filter auctions starting before this date',
    example: '2024-03-25T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  auctionStartBefore?: string;

  @ApiProperty({
    description: 'Filter auctions ending after this date',
    example: '2024-03-20T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  auctionEndAfter?: string;

  @ApiProperty({
    description: 'Filter auctions ending before this date',
    example: '2024-03-26T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  auctionEndBefore?: string;

  @ApiProperty({
    description: 'Filter auctions created after this date',
    example: '2024-03-15T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiProperty({
    description: 'Filter auctions created before this date',
    example: '2024-03-20T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiProperty({
    description: 'Minimum total bids count filter',
    example: 5,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotalBids?: number;

  @ApiProperty({
    description: 'Maximum total bids count filter',
    example: 50,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTotalBids?: number;

  @ApiProperty({
    description: 'Minimum total participants count filter',
    example: 3,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotalParticipants?: number;

  @ApiProperty({
    description: 'Maximum total participants count filter',
    example: 20,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTotalParticipants?: number;

  @ApiProperty({
    description: 'Whether to populate NFT data in response',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  populateNFT?: boolean = false;

  @ApiProperty({
    description: 'Sort field for results',
    example: 'createdAt',
    required: false,
    enum: [
      'createdAt',
      'updatedAt',
      'startingPrice',
      'currentHighestBid',
      'totalBids',
      'totalParticipants',
      'auctionConfig.startTime',
      'auctionConfig.endTime',
    ],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort order for results',
    example: 'desc',
    required: false,
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
