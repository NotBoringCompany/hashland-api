import {
  IsMongoId,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BidType } from '../schemas/bid.schema';

/**
 * DTO for bid metadata
 */
export class BidMetadataDto {
  @ApiProperty({
    description: 'User agent string from the browser',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({
    description: 'IP address of the bidder',
    example: '192.168.1.1',
    required: false,
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    description: 'Source of the bid (api, websocket, etc.)',
    example: 'websocket',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    description: 'Socket ID for WebSocket bids',
    example: 'socket_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  socketId?: string;

  @ApiProperty({
    description: 'Additional timestamp for bid tracking',
    example: '2024-03-19T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

/**
 * DTO for placing a bid
 */
export class PlaceBidDto {
  @ApiProperty({
    description: 'The ID of the operator placing the bid',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  bidderId: string;

  @ApiProperty({
    description: 'The bid amount in HASH currency',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'The type of bid',
    enum: BidType,
    example: BidType.REGULAR,
    required: false,
  })
  @IsOptional()
  @IsEnum(BidType)
  bidType?: BidType;

  @ApiProperty({
    description: 'Additional metadata for the bid',
    type: BidMetadataDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BidMetadataDto)
  metadata?: BidMetadataDto;
}
