import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopItem } from './schemas/shop-item.schema';
import { ShopItemType } from 'src/common/enums/shop.enum';
import { ShopItemEffect } from 'src/common/schemas/shop-item-effect.schema';

@Injectable()
export class ShopItemService {
  constructor(
    @InjectModel(ShopItem.name) private shopItemModel: Model<ShopItem>,
  ) {}

  async createShopItem(
    item: ShopItemType,
    itemEffect: ShopItemEffect,
    description: string,
    purchaseCost: number,
  ): Promise<ApiResponse<{ shopItemId: string } | null>> {
    try {
      const shopItem = await this.shopItemModel.create({
        item,
        itemEffect,
        description,
        purchaseCost,
      });
      return new ApiResponse<{ shopItemId: string }>(
        200,
        `(createShopItem) Shop item created.`,
        {
          shopItemId: String(shopItem._id),
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(createShopItem) Error creating shop item: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Fetch all shop items. Optional projection to filter out fields.
   */
  async getAllShopItems(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ shopItems: ShopItem[] }>> {
    try {
      const shopItems = await this.shopItemModel
        .find({})
        .select(projection)
        .lean();
      return new ApiResponse<{ shopItems: ShopItem[] }>(
        200,
        `(getAllShopItems) Fetched ${shopItems.length} shop items.`,
        { shopItems },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getAllShopItems) Error fetching shop items: ${err.message}`,
        ),
      );
    }
  }
}
