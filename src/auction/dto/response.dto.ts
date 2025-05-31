import { ApiProperty } from '@nestjs/swagger';
import { NFT } from '../schemas/nft.schema';
import { Auction } from '../schemas/auction.schema';
import { AuctionHistory } from '../schemas/auction-history.schema';

/**
 * Base pagination response DTO
 */
export class PaginationResponseDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

/**
 * Paginated NFT response DTO
 */
export class PaginatedNFTResponseDto extends PaginationResponseDto {
  @ApiProperty({
    description: 'Array of NFTs',
    type: [NFT],
  })
  nfts: NFT[];
}

/**
 * Paginated auction response DTO
 */
export class PaginatedAuctionResponseDto extends PaginationResponseDto {
  @ApiProperty({
    description: 'Array of auctions',
    type: [Auction],
  })
  auctions: Auction[];
}

/**
 * Paginated auction history response DTO
 */
export class PaginatedAuctionHistoryResponseDto extends PaginationResponseDto {
  @ApiProperty({
    description: 'Array of auction history records',
    type: [AuctionHistory],
  })
  history: AuctionHistory[];
}

/**
 * Generic API error response DTO
 */
export class ApiErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'Error details (for validation errors)',
    example: ['title should not be empty', 'amount must be a positive number'],
    required: false,
  })
  error?: string[];

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2024-03-19T12:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path',
    example: '/auctions',
  })
  path: string;
}
