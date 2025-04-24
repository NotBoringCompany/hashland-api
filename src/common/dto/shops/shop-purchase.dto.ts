import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { ApiResponse } from '../response.dto';

export class PurchaseItemDto {
  @ApiProperty({
    description:
      'The database ID of the operator who wants to make the purchase',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({
    description: 'The database ID of the shop item to purchase',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  @IsNotEmpty()
  shopItemId: string;

  @ApiProperty({
    description: 'The name of the shop item to purchase',
    example: 'REPLENISH_FUEL',
  })
  @IsString()
  @IsNotEmpty()
  shopItemName: string;

  @ApiProperty({
    description: 'The wallet address the purchase is made from',
    example: 'EQDrLq-X6jKZNHAScgghh0h1iog3StK71zfAxNOYVlPP70wY',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'The chain used to make the purchase',
    example: 'TON',
  })
  @IsString()
  @IsNotEmpty()
  chain: AllowedChain;

  @ApiProperty({
    description: 'The transaction hash (or BOC for TON) of the purchase',
    example:
      'te6cckECEQEAAzYAART/APSkE/S88sgLAQIBYgIDAgLMBAUCASAGBwIBIAgJAHW0qWl8sMnP...',
  })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

/**
 * Represents the data structure for a shop purchase response
 */
export class ShopPurchaseResponseDto {
  @ApiProperty({
    description: 'The database ID of the shop purchase',
    example: '507f1f77bcf86cd799439013',
  })
  shopPurchaseId: string;

  @ApiProperty({
    description: 'The database ID of the operator who made the purchase',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  operatorId?: string;

  @ApiProperty({
    description: 'The name of the item purchased',
    example: 'REPLENISH_FUEL',
    required: false,
  })
  itemPurchased?: string;

  @ApiProperty({
    description: 'The cost of the purchase',
    example: 0.95,
    required: false,
  })
  totalCost?: number;

  @ApiProperty({
    description: 'The currency used for the purchase',
    example: 'TON',
    required: false,
  })
  currency?: string;

  @ApiProperty({
    description: 'When the purchase was made',
    example: '2023-07-15T12:34:56.789Z',
    required: false,
  })
  createdAt?: Date;
}

/**
 * API Response for the purchase item endpoint
 */
export class PurchaseItemResponseDto extends ApiResponse.withType(
  ShopPurchaseResponseDto,
) {}

export class CheckPurchaseAllowedDto {
  @ApiProperty({
    description:
      'The database ID of the operator who wants to make the purchase',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({
    description: 'The database ID of the shop item to purchase',
    example: '507f1f77bcf86cd799439012',
    required: false,
  })
  @IsString()
  shopItemId?: string;

  @ApiProperty({
    description: 'The name of the shop item to purchase',
    example: 'REPLENISH_FUEL',
    required: false,
  })
  @IsOptional()
  shopItemName?: string;

  @ApiProperty({
    description: 'Whether to include shop item effects in the response',
    example: true,
    default: false,
  })
  @IsOptional()
  showShopItemEffects?: boolean;

  @ApiProperty({
    description: 'Whether to include shop item price in the response',
    example: true,
    default: false,
  })
  @IsOptional()
  showShopItemPrice?: boolean;
}

/**
 * Represents the data structure for the check purchase allowed response
 */
export class CheckPurchaseAllowedDataDto {
  @ApiProperty({
    description: 'Whether the purchase is allowed',
    example: true,
  })
  purchaseAllowed: boolean;

  @ApiProperty({
    description: 'If purchase is not allowed, the reason why',
    example: 'Requires at least 1 BASIC drills, but only 0 found.',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description:
      'The effects of the shop item (if showShopItemEffects is true)',
    type: ShopItemEffects,
    required: false,
  })
  shopItemEffects?: ShopItemEffects;

  @ApiProperty({
    description: 'The price of the shop item (if showShopItemPrice is true)',
    example: {
      ton: 1,
      bera: 1,
    },
    required: false,
  })
  shopItemPrice?: {
    ton: number;
    bera: number;
  };
}

/**
 * API Response for the check purchase allowed endpoint
 */
export class CheckPurchaseAllowedResponseDto extends ApiResponse.withType(
  CheckPurchaseAllowedDataDto,
) {}
