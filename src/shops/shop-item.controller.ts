import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopItemService } from './shop-item.service';
import { ShopItem } from './schemas/shop-item.schema';

@Controller('shop-items') // Base route: `/shop-items`
export class ShopItemController {
  constructor(private readonly shopItemService: ShopItemService) {}

  /**
   * GET `/`
   * Fetches all shop items with optional field projection.
   * Example: `?projection=version,config`
   */
  @Get()
  async getShopItems(
    @Query('projection') projection?: string,
  ): Promise<ApiResponse<{ shopItems: Partial<ShopItem[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.shopItemService.getShopItems(projectionObj);
  }
}
