import { IsString, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlaceBidDto } from './place-bid.dto';

/**
 * DTO for joining auction room
 */
export class JoinAuctionDto {
  @ApiProperty({
    description: 'The ID of the auction to join',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;
}

/**
 * DTO for leaving auction room
 */
export class LeaveAuctionDto {
  @ApiProperty({
    description: 'The ID of the auction to leave',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;
}

/**
 * DTO for getting auction status
 */
export class GetAuctionStatusDto {
  @ApiProperty({
    description: 'The ID of the auction to get status for',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;
}

/**
 * DTO for WebSocket bid placement (extends PlaceBidDto with auction ID)
 */
export class WebSocketPlaceBidDto extends PlaceBidDto {
  @ApiProperty({
    description: 'The ID of the auction to place bid in',
    example: '507f1f77bcf86cd799439012',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  auctionId?: string;
}

/**
 * Base WebSocket response DTO
 */
export class WebSocketResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Timestamp of the response',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsString()
  timestamp: string;
}

/**
 * Connection confirmation response DTO
 */
export class ConnectionConfirmedDto extends WebSocketResponseDto {
  @ApiProperty({
    description: 'The operator ID of the connected user',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  operatorId: string;
}

/**
 * Error response DTO
 */
export class WebSocketErrorDto {
  @ApiProperty({
    description: 'Error message',
    example: 'Unauthorized access',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2024-03-19T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

/**
 * User joined/left room notification DTO
 */
export class UserRoomNotificationDto {
  @ApiProperty({
    description: 'The operator ID of the user',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  operatorId: string;

  @ApiProperty({
    description: 'Timestamp of the event',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsString()
  timestamp: string;
}

/**
 * Auction ending soon notification DTO
 */
export class AuctionEndingSoonDto {
  @ApiProperty({
    description: 'The auction ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;

  @ApiProperty({
    description: 'Minutes left until auction ends',
    example: 5,
  })
  minutesLeft: number;

  @ApiProperty({
    description: 'Timestamp of the notification',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsString()
  timestamp: string;
}

/**
 * Whitelist status change notification DTO
 */
export class WhitelistStatusChangeDto {
  @ApiProperty({
    description: 'The auction ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  auctionId: string;

  @ApiProperty({
    description: 'New whitelist status',
    example: 'open',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Timestamp of the status change',
    example: '2024-03-19T12:00:00.000Z',
  })
  @IsString()
  timestamp: string;
}
