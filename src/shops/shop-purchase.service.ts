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
import { ShopItemEffects } from 'src/common/schemas/shop-item-effect.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { TonService } from 'src/ton/ton.service';
import { DrillConfig } from 'src/common/enums/drill.enum';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { BlockchainData } from 'src/common/schemas/blockchain-payment.schema';
import { AlchemyService } from 'src/alchemy/alchemy.service';

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
    private readonly tonService: TonService,
    private readonly alchemyService: AlchemyService,
  ) {}

  /**
   * Purchase an item from the shop. Returns the ShopPurchase instance's ID if successful, or null if the purchase failed.
   */
  async purchaseItem(
    operatorId: Types.ObjectId,
    shopItemId: Types.ObjectId,
    shopItemName: string,
    /** The chain the purchase was made from */
    chain: AllowedChain,
    /** The address the purchase was made from */
    address: string,
    /** The transaction hash (or BOC for TON transactions) of the purchase */
    txHash: string,
  ): Promise<
    ApiResponse<{
      shopPurchaseId: string;
      operatorId: string;
      itemPurchased: string;
      totalCost: number;
      currency: string;
      createdAt: Date;
    } | null>
  > {
    try {
      // Check if the purchase is allowed
      const purchaseAllowedResponse = await this.checkPurchaseAllowed(
        operatorId,
        true,
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
      let blockchainData: BlockchainData | null = null;

      if (chain === AllowedChain.TON) {
        blockchainData = await this.tonService.verifyTONTransaction(
          operatorId,
          address,
          txHash,
        );
      } else if (chain === AllowedChain.BERA) {
        blockchainData = await this.alchemyService.verifyEVMTransaction(
          operatorId,
          address,
          chain,
          txHash,
          shopItemName,
          purchaseAllowedResponse.data.shopItemPrice.bera,
        );
      }

      if (!blockchainData) {
        return new ApiResponse<null>(
          403,
          `(purchaseItem) Invalid blockchain transaction.`,
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

      // Grant the effects of the shop item to the operator
      this.grantShopItemEffect(
        operatorId,
        purchaseAllowedResponse.data.shopItemEffects,
      );

      return new ApiResponse(
        200,
        `(purchaseItem) Item purchased successfully.`,
        {
          shopPurchaseId: String(shopPurchase._id),
          operatorId: String(shopPurchase.operatorId),
          itemPurchased: shopPurchase.itemPurchased,
          totalCost: shopPurchase.totalCost,
          currency: shopPurchase.currency,
          createdAt: shopPurchase.createdAt,
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
      const bulkOperations: any[] = [];

      // ✅ Step 1: Grant a new drill if applicable
      if (shopItemEffects.drillData) {
        const newDrill = new this.drillModel({
          operatorId,
          version: shopItemEffects.drillData.version,
          config: shopItemEffects.drillData.config,
          extractorAllowed: true,
          level: 1,
          actualEff: shopItemEffects.drillData.baseEff,
        });

        await newDrill.save();

        // ✅ Prepare cumulativeEff update
        bulkOperations.push({
          updateOne: {
            filter: { _id: operatorId },
            update: {
              $inc: { cumulativeEff: shopItemEffects.drillData.baseEff },
            },
          },
        });
      }

      // ✅ Step 2: Increase maxFuel if applicable
      if (
        shopItemEffects.maxFuelIncrease &&
        shopItemEffects.maxFuelIncrease > 0
      ) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: operatorId },
            update: { $inc: { maxFuel: shopItemEffects.maxFuelIncrease } },
          },
        });
      }

      // ✅ Step 3: Replenish fuel (without exceeding maxFuel)
      if (
        shopItemEffects.replenishFuelRatio &&
        shopItemEffects.replenishFuelRatio > 0
      ) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: operatorId },
            update: [
              {
                $set: {
                  currentFuel: {
                    $min: [
                      {
                        $add: [
                          '$currentFuel',
                          {
                            $multiply: [
                              '$maxFuel',
                              shopItemEffects.replenishFuelRatio,
                            ],
                          },
                        ],
                      },
                      '$maxFuel',
                    ],
                  },
                },
              },
            ],
          },
        });
      }

      // ✅ Step 4: Execute bulk updates if there are operations to perform
      if (bulkOperations.length > 0) {
        await this.operatorModel.bulkWrite(bulkOperations);
      }

      this.logger.log(
        `✅ (grantShopItemEffect) Successfully granted shop item effect to operator ${operatorId}.`,
      );
    } catch (err: any) {
      this.logger.error(
        `❌ (grantShopItemEffect) Error granting shop item effect to operator ${operatorId}: ${err.message}`,
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
   * Optionally returns the shop item's price if `showShopItemPrice` is set to true.
   */
  async checkPurchaseAllowed(
    operatorId: Types.ObjectId,
    showShopItemEffects: boolean = false,
    showShopItemPrice: boolean = false,
    shopItemId?: Types.ObjectId,
    shopItemName?: string,
  ): Promise<
    ApiResponse<{
      purchaseAllowed: boolean;
      reason?: string;
      shopItemEffects?: ShopItemEffects;
      shopItemPrice?: {
        ton: number;
        bera: number;
      };
    } | null>
  > {
    try {
      if (!shopItemId && !shopItemName) {
        return new ApiResponse<{ purchaseAllowed: boolean; reason: string }>(
          400,
          `(checkPurchaseAllowed) Invalid request. Either shopItemId or shopItemName must be provided.`,
          { purchaseAllowed: false, reason: 'Missing shop item identifier.' },
        );
      }

      const query: any = shopItemId
        ? { _id: shopItemId }
        : { item: shopItemName };

      // ✅ Fetch Shop Item
      const shopItem = await this.shopItemModel
        .findOne(query, {
          item: 1,
          ...(showShopItemEffects && { itemEffects: 1 }),
          ...(showShopItemPrice && { purchaseCost: 1 }),
        })
        .lean();

      if (!shopItem) {
        return new ApiResponse<{ purchaseAllowed: boolean; reason: string }>(
          404,
          `(checkPurchaseAllowed) Shop item not found.`,
          { purchaseAllowed: false, reason: 'Shop item does not exist.' },
        );
      }

      const itemName = shopItem.item.toLowerCase();

      // ✅ Drill purchase limit and other prerequisites check
      if (itemName.includes('drill')) {
        const maxDrillsAllowed =
          GAME_CONSTANTS.DRILLS.BASE_PREMIUM_DRILLS_ALLOWED +
          GAME_CONSTANTS.DRILLS.BASE_BASIC_DRILLS_ALLOWED;

        // Fetch all drills and operator data in parallel
        const [operatorDrills, operator] = await Promise.all([
          this.drillModel.find({ operatorId }, { config: 1 }),
          this.operatorModel.findById(operatorId, { maxFuel: 1 }),
        ]);

        if (operatorDrills.length >= maxDrillsAllowed) {
          return new ApiResponse<{ purchaseAllowed: boolean; reason: string }>(
            403,
            `(checkPurchaseAllowed) Operator has reached the maximum number of drills allowed.`,
            {
              purchaseAllowed: false,
              reason: `Max drills reached (${maxDrillsAllowed}).`,
            },
          );
        }

        // ✅ Count drill types in one iteration
        const drillCounts = operatorDrills.reduce(
          (counts, drill) => {
            counts[drill.config] = (counts[drill.config] || 0) + 1;
            return counts;
          },
          {} as Record<DrillConfig, number>,
        );

        // ✅ Define prerequisite checks dynamically
        const prerequisites = {
          bulwark: {
            requiredType: DrillConfig.IRONBORE,
            requiredCount:
              GAME_CONSTANTS.DRILLS.BULWARK_DRILL_PURCHASE_PREREQUISITES
                .ironboreDrillsRequired,
            maxFuel:
              GAME_CONSTANTS.DRILLS.BULWARK_DRILL_PURCHASE_PREREQUISITES
                .maxFuelRequired,
          },
          titan: {
            requiredType: DrillConfig.BULWARK,
            requiredCount:
              GAME_CONSTANTS.DRILLS.TITAN_DRILL_PURCHASE_PREREQUISITES
                .bulwarkDrillsRequired,
            maxFuel:
              GAME_CONSTANTS.DRILLS.TITAN_DRILL_PURCHASE_PREREQUISITES
                .maxFuelRequired,
          },
          dreadnought: {
            requiredType: DrillConfig.TITAN,
            requiredCount:
              GAME_CONSTANTS.DRILLS.DREADNOUGHT_DRILL_PURCHASE_PREREQUISITES
                .titanDrillsRequired,
            maxFuel:
              GAME_CONSTANTS.DRILLS.DREADNOUGHT_DRILL_PURCHASE_PREREQUISITES
                .maxFuelRequired,
          },
        } as const;

        for (const [
          key,
          { requiredType, requiredCount, maxFuel },
        ] of Object.entries(prerequisites)) {
          if (itemName.includes(key)) {
            const ownedCount = drillCounts[requiredType] ?? 0;

            if (ownedCount < requiredCount) {
              return new ApiResponse<{
                purchaseAllowed: boolean;
                reason: string;
              }>(
                403,
                `(checkPurchaseAllowed) Operator does not meet drill prerequisites.`,
                {
                  purchaseAllowed: false,
                  reason: `Requires at least ${requiredCount} ${requiredType} drills, but only ${ownedCount} found.`,
                },
              );
            }
            if (operator.maxFuel < maxFuel) {
              return new ApiResponse<{
                purchaseAllowed: boolean;
                reason: string;
              }>(
                403,
                `(checkPurchaseAllowed) Operator does not have enough maxFuel.`,
                {
                  purchaseAllowed: false,
                  reason: `Requires ${maxFuel} max fuel, but only ${operator.maxFuel} available.`,
                },
              );
            }
          }
        }
      }

      // ✅ Return success with optional item effect
      return new ApiResponse<{
        purchaseAllowed: boolean;
        shopItemEffects?: ShopItemEffects;
        shopItemPrice?: {
          ton: number;
          bera: number;
        };
      }>(200, `(checkPurchaseAllowed) Purchase allowed.`, {
        purchaseAllowed: true,
        shopItemEffects: showShopItemEffects ? shopItem.itemEffects : undefined,
        shopItemPrice: showShopItemPrice ? shopItem.purchaseCost : undefined,
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
