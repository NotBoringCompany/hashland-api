import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsString,
  IsDateString,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuctionAction } from '../schemas/auction-history.schema';

/**
 * DTO for querying auction history with pagination and filtering
 */
export class GetAuctionHistoryQueryDto {
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
    example: 50,
    required: false,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiProperty({
    description: 'Filter by auction action type',
    enum: AuctionAction,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuctionAction)
  action?: AuctionAction;

  @ApiProperty({
    description: 'Filter by operator ID who performed the action',
    example: '507f1f77bcf86cd799439013',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  operatorId?: string;

  @ApiProperty({
    description: 'Filter actions after this timestamp',
    example: '2024-03-19T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  timestampAfter?: string;

  @ApiProperty({
    description: 'Filter actions before this timestamp',
    example: '2024-03-25T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  timestampBefore?: string;

  @ApiProperty({
    description: 'Filter by minimum bid amount (for bid-related actions)',
    example: 100,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiProperty({
    description: 'Filter by maximum bid amount (for bid-related actions)',
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiProperty({
    description: 'Filter actions created after this date',
    example: '2024-03-15T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiProperty({
    description: 'Filter actions created before this date',
    example: '2024-03-20T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiProperty({
    description: 'Sort field for results',
    example: 'timestamp',
    required: false,
    enum: ['timestamp', 'createdAt', 'action', 'details.amount'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @ApiProperty({
    description: 'Sort order for results',
    example: 'desc',
    required: false,
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    description: 'Whether to populate auction data in response',
    example: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  populateAuction?: boolean = false;

  @ApiProperty({
    description: 'Whether to populate operator data in response',
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  populateOperator?: boolean = true;
}
