import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';

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

export class PurchaseItemResponseDto {
  @ApiProperty({
    description: 'The database ID of the shop purchase',
    example: '507f1f77bcf86cd799439013',
  })
  shopPurchaseId: string;
}

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
  @IsString()
  shopItemName?: string;

  @ApiProperty({
    description: 'Whether to include shop item effects in the response',
    example: true,
    default: false,
  })
  showShopItemEffects?: boolean;

  @ApiProperty({
    description: 'Whether to include shop item price in the response',
    example: true,
    default: false,
  })
  showShopItemPrice?: boolean;
}

export class CheckPurchaseAllowedResponseDto {
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
