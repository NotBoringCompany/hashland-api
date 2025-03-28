import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { ShopItem } from './schemas/shop-item.schema';
import { ShopItemType } from 'src/common/enums/shop.enum';

@Injectable()
export class ShopItemService {
  constructor(
    @InjectModel(ShopItem.name) private shopItemModel: Model<ShopItem>,
  ) {}

  /**
   * Add a new shop item to the database.
   */
  async addShopItem(
    item: ShopItemType,
    itemEffects: ShopItemEffects,
    description: string,
    purchaseCost: {
      ton: number;
      bera: number;
    },
  ): Promise<ApiResponse<{ shopItemId: string } | null>> {
    try {
      const shopItem = await this.shopItemModel.create({
        item,
        itemEffects,
        description,
        purchaseCost,
      });
      return new ApiResponse<{ shopItemId: string }>(
        200,
        `(addShopItem) Shop item created.`,
        {
          shopItemId: String(shopItem._id),
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(addShopItem) Error creating shop item: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Fetch all shop items. Optional projection to filter out fields.
   */
  async getShopItems(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ shopItems: ShopItem[] }>> {
    try {
      const shopItems = await this.shopItemModel
        .find({})
        .select(projection)
        .lean();
      return new ApiResponse<{ shopItems: ShopItem[] }>(
        200,
        `(getShopItems) Fetched ${shopItems.length} shop items.`,
        { shopItems },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getShopItems) Error fetching shop items: ${err.message}`,
        ),
      );
    }
  }
}
