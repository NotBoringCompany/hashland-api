import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  ValidateNested,
  IsOptional,
  Min,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for whitelist configuration
 */
export class WhitelistConfigDto {
  @ApiProperty({
    description: 'Maximum number of participants allowed in whitelist',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  maxParticipants: number;

  @ApiProperty({
    description: 'Entry fee required to join whitelist (in HASH)',
    example: 50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  entryFee: number;

  @ApiProperty({
    description: 'Whitelist start time (ISO string)',
    example: '2024-03-19T10:00:00.000Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Whitelist end time (ISO string)',
    example: '2024-03-20T10:00:00.000Z',
  })
  @IsDateString()
  endTime: string;
}

/**
 * DTO for auction configuration
 */
export class AuctionConfigDto {
  @ApiProperty({
    description: 'Auction start time (ISO string)',
    example: '2024-03-20T12:00:00.000Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Auction end time (ISO string)',
    example: '2024-03-21T12:00:00.000Z',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    description: 'Minimum bid increment (in HASH)',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  minBidIncrement: number;

  @ApiProperty({
    description: 'Reserve price for the auction (in HASH)',
    example: 200,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @ApiProperty({
    description: 'Buy now price for instant purchase (in HASH)',
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buyNowPrice?: number;
}

/**
 * DTO for creating a new auction
 */
export class CreateAuctionDto {
  @ApiProperty({
    description: 'The ID of the NFT to auction',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  nftId: string;

  @ApiProperty({
    description: 'The title of the auction',
    example: 'Rare Digital Artwork Auction',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'The description of the auction',
    example: 'A unique opportunity to own this rare digital artwork',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Starting price of the auction (in HASH)',
    example: 100,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  startingPrice: number;

  @ApiProperty({
    description: 'Whitelist configuration for the auction',
    type: WhitelistConfigDto,
  })
  @ValidateNested()
  @Type(() => WhitelistConfigDto)
  whitelistConfig: WhitelistConfigDto;

  @ApiProperty({
    description: 'Auction configuration',
    type: AuctionConfigDto,
  })
  @ValidateNested()
  @Type(() => AuctionConfigDto)
  auctionConfig: AuctionConfigDto;
}
