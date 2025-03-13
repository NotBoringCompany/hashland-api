import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopDrillService } from './shop-drill.service';
import { ShopDrill } from './schemas/shop-drill.schema';

@Controller('shop-drills') // Base route: `/pools`
export class ShopDrillsController {
  constructor(private readonly shopDrillService: ShopDrillService) {}

  /**
   * GET `/shop-drills`
   * Fetches all shop drills with optional field projection.
   * Example: `/shop-drills?projection=version,config`
   */
  @Get()
  async getAllShopDrills(
    @Query('projection') projection?: string,
  ): Promise<ApiResponse<{ shopDrills: Partial<ShopDrill[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.shopDrillService.getAllShopDrills(projectionObj);
  }
}
