import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ShopPurchase } from './schemas/shop-purchase.schema';
import { Model, Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopItem } from './schemas/shop-item.schema';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { Drill } from 'src/drills/schemas/drill.schema';
import { verifyTONTransaction } from 'src/common/utils/ton-utils';
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { Operator } from 'src/operators/schemas/operator.schema';

@Injectable()
export class ShopPurchaseService {
  private readonly logger = new Logger(ShopPurchaseService.name);

  constructor(
    @InjectModel(ShopPurchase.name)
    private readonly shopPurchaseModel: Model<ShopPurchase>,
    @InjectModel(ShopItem.name)
    private readonly shopItemModel: Model<ShopItem>,
    @InjectModel(Drill.name)
    private readonly drillModel: Model<Drill>,
    @InjectModel(Operator.name)
    private readonly operatorModel: Model<Operator>,
  ) {}

  /**
   * Purchase an item from the shop. Returns the ShopPurchase instance's ID if successful, or null if the purchase failed.
   */
  async purchaseItem(
    operatorId: Types.ObjectId,
    shopItemId: Types.ObjectId,
    shopItemName: string,
    /** The address the purchase was made from */
    address: string,
    /** The BOC (TX Hash) of the purchase */
    boc: string,
  ): Promise<
    ApiResponse<{
      shopPurchaseId: string;
    } | null>
  > {
    try {
      // Check if the purchase is allowed
      const purchaseAllowedResponse = await this.checkPurchaseAllowed(
        operatorId,
        true,
        shopItemId,
        shopItemName,
      );

      if (purchaseAllowedResponse.status !== 200) {
        return new ApiResponse<null>(
          purchaseAllowedResponse.status,
          purchaseAllowedResponse.message,
        );
      }

      // Check if the payment is valid
      const blockchainData = await verifyTONTransaction(
        operatorId,
        address,
        boc,
      );

      if (!blockchainData) {
        return new ApiResponse<null>(
          403,
          `(purchaseItem) Invalid TON transaction.`,
        );
      }

      // Create a new shop purchase
      const shopPurchase = await this.shopPurchaseModel.create({
        operatorId,
        itemPurchased: shopItemName,
        amount: 1,
        totalCost: blockchainData.txPayload.cost,
        currency: blockchainData.txPayload.curr,
        blockchainData,
      });

      return new ApiResponse<{ shopPurchaseId: string }>(
        200,
        `(purchaseItem) Item purchased successfully.`,
        {
          shopPurchaseId: String(shopPurchase._id),
        },
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(purchaseItem) Error purchasing item: ${err.message}`,
      );
    }
  }

  /**
   * Grants the operator the effect of a shop item. For example,
   * if the shop item is a drill, we would create a new drill for the operator and update the cumulative EFF of the operator.
   */
  async grantShopItemEffect(
    operatorId: Types.ObjectId,
    shopItemEffects: ShopItemEffects,
  ): Promise<void> {
    try {
      // If drill data is included, grant the operator a new drill and update the cumulativeEff
      if (shopItemEffects.drillData) {
        // Create a new drill for the operator
        await this.drillModel.create({
          operatorId,
          version: shopItemEffects.drillData.version,
          config: shopItemEffects.drillData.config,
          extractorAllowed: true,
          level: 1,
          actualEff: shopItemEffects.drillData.baseEff,
        });

        // Update the operator's cumulativeEff (increment by this drill's baseEff)
        await this.operatorModel.findOneAndUpdate(
          { _id: operatorId },
          {
            $inc: {
              cumulativeEff: shopItemEffects.drillData.baseEff,
            },
          },
        );
      }

      // Add more effects here later
    } catch (err: any) {
      this.logger.error(
        `(grantShopItemEffect) Error granting shop item effect to user ${operatorId}: ${err.message}`,
      );
    }
  }

  /**
   * Checks the prerequisites of a purchase before continuing. Returns true if the purchase is allowed, false if not.
   *
   * NOTE: Although this function gets called in `purchaseItem`, it also needs to be called in the FE before attempting to purchase an item.
   * Otherwise, the operator might have already paid for the item even though the purchase is not allowed.
   *
   * Optionally returns the shop item's effect if `showShopItemEffect` is set to true.
   */
  async checkPurchaseAllowed(
    operatorId: Types.ObjectId,
    /** If the shop item's `itemEffects` should be returned. By default, this will be false to reduce data return size. */
    showShopItemEffects: boolean = false,
    shopItemId?: Types.ObjectId,
    shopItemName?: string,
  ): Promise<
    ApiResponse<{
      purchaseAllowed: boolean;
      shopItemEffects?: ShopItemEffects;
    } | null>
  > {
    try {
      // ✅ Construct query conditions dynamically to avoid unnecessary queries
      const query: any = {};
      if (shopItemId) query._id = shopItemId;
      else if (shopItemName) query.item = shopItemName;
      else {
        return new ApiResponse<{ purchaseAllowed: boolean }>(
          400,
          `(checkPurchaseAllowed) Invalid request. Either shopItemId or shopItemName must be provided.`,
          { purchaseAllowed: false },
        );
      }

      // ✅ Fetch Shop Item
      const shopItem = await this.shopItemModel
        .findOne(query, {
          item: 1,
          ...(showShopItemEffects && { itemEffect: 1 }), // ✅ Fetch itemEffect only if required
        })
        .lean();

      if (!shopItem) {
        return new ApiResponse<{ purchaseAllowed: boolean }>(
          404,
          `(checkPurchaseAllowed) Shop item not found.`,
          { purchaseAllowed: false },
        );
      }

      // ✅ Drill purchase limit check
      if (shopItem.item.toLowerCase().includes('drill')) {
        const maxDrillsAllowed =
          GAME_CONSTANTS.DRILLS.BASE_PREMIUM_DRILLS_ALLOWED;

        // Count the number of drills the operator owns
        const operatorDrillCount = await this.drillModel.countDocuments({
          operatorId,
        });

        if (operatorDrillCount >= maxDrillsAllowed) {
          return new ApiResponse<{ purchaseAllowed: boolean }>(
            403,
            `(checkPurchaseAllowed) Operator has reached the maximum number of drills allowed.`,
            { purchaseAllowed: false },
          );
        }
      }

      // ✅ Return success with optional item effect
      return new ApiResponse<{
        purchaseAllowed: boolean;
        shopItemEffects?: ShopItemEffects;
      }>(200, `(checkPurchaseAllowed) Purchase allowed.`, {
        purchaseAllowed: true,
        shopItemEffects: showShopItemEffects ? shopItem.itemEffects : undefined,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(checkPurchaseAllowed) Error checking prerequisites: ${err.message}`,
        ),
      );
    }
  }
}
