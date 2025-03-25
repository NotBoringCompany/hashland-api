import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { ShopItemService } from './shop-item.service';
import { ShopItem } from './schemas/shop-item.schema';
import {
  GetShopItemsQueryDto,
  GetShopItemsResponseDto,
} from 'src/common/dto/shops/shop-item.dto';

@ApiTags('Shop Items')
@Controller('shop-items') // Base route: `/shop-items`
export class ShopItemController {
  constructor(private readonly shopItemService: ShopItemService) {}

  @ApiOperation({
    summary: 'Get all shop items',
    description:
      'Fetches all available shop items with optional field projection',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved shop items',
    type: GetShopItemsResponseDto,
  })
  @Get()
  async getShopItems(
    @Query() query: GetShopItemsQueryDto,
  ): Promise<AppApiResponse<{ shopItems: Partial<ShopItem[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = query.projection
      ? query.projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.shopItemService.getShopItems(projectionObj);
  }
}
