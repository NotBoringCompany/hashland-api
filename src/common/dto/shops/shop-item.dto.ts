import { ApiProperty } from '@nestjs/swagger';
import { ShopItem } from 'src/shops/schemas/shop-item.schema';
import { IsOptional, IsString } from 'class-validator';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { ShopItemType } from 'src/common/enums/shop.enum';

export class GetShopItemsResponseDto {
  @ApiProperty({
    description: 'Array of shop items',
    type: [ShopItem],
  })
  shopItems: Partial<ShopItem[]>;
}

export class CreateShopItemDto {
  @ApiProperty({
    description: 'The type of shop item',
    enum: ShopItemType,
    example: ShopItemType.REPLENISH_FUEL,
  })
  item: ShopItemType;

  @ApiProperty({
    description: 'The effects of the shop item',
    type: ShopItemEffects,
    example: {
      replenishFuelRatio: 1,
    },
  })
  itemEffects: ShopItemEffects;

  @ApiProperty({
    description: 'The description of the shop item',
    example: 'Replenishes fuel back to max capacity.',
  })
  description: string;

  @ApiProperty({
    description: 'The cost of the shop item in TON',
    example: 0.95,
  })
  purchaseCost: number;
}

export class GetShopItemsQueryDto {
  @ApiProperty({
    description: 'Comma-separated list of fields to include in the response',
    required: false,
    example: 'item,description,purchaseCost',
  })
  @IsString()
  @IsOptional()
  projection?: string;
}
