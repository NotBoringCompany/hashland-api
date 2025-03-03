import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ShopDrill } from './schemas/shop-drill.schema';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';

@Injectable()
export class ShopDrillsService {
  constructor(
    @InjectModel(ShopDrill.name) private shopDrillModel: Model<ShopDrill>,
  ) {}

  /**
   * Create a shop drill with the given specifications. Only callable by admin.
   */
  async createShopDrill(
    version: DrillVersion,
    config: DrillConfig,
    purchaseCost: number,
    baseEff: number,
    maxLevel: number,
  ): Promise<ApiResponse<{ shopDrillId: string }>> {
    try {
      const shopDrill = await this.shopDrillModel.create({
        config,
        version,
        purchaseCost,
        baseEff,
        maxLevel,
      });
      return new ApiResponse<{ shopDrillId: string }>(
        200,
        `(createShopDrill) Shop drill created.`,
        {
          shopDrillId: String(shopDrill._id),
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(createShopDrill) Error creating shop drill: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Fetch all shop drills. Optional projection to filter out fields.
   */
  async getAllShopDrills(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ shopDrills: ShopDrill[] }>> {
    try {
      const shopDrills = await this.shopDrillModel
        .find({})
        .select(projection)
        .lean();
      return new ApiResponse<{ shopDrills: ShopDrill[] }>(
        200,
        `(getAllShopDrills) Fetched ${shopDrills.length} shop drills.`,
        { shopDrills },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getAllShopDrills) Error fetching shop drills: ${err.message}`,
        ),
      );
    }
  }
}
