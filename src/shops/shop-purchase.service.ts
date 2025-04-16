import {
  BadRequestException,
  ForbiddenException,
  HttpException,
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
import { RedisService } from 'src/common/redis.service';
import { DrillingGatewayService } from 'src/gateway/drilling.gateway.service';

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
    private readonly redisService: RedisService,
    private readonly drillingGatewayService: DrillingGatewayService,
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
        throw new ForbiddenException(
          `(purchaseItem) Purchase not allowed: ${purchaseAllowedResponse.message}`,
        );
      }

      // Check if this tx hash was already used for a purchase
      const existingPurchase = await this.shopPurchaseModel.exists({
        'blockchainData.txHash': txHash,
      });

      if (existingPurchase) {
        throw new ForbiddenException(
          `(purchaseItem) Transaction hash already used for a purchase.`,
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
        throw new BadRequestException(
          `(purchaseItem) Invalid blockchain transaction.`,
        );
      }

      this.logger.debug(
        `(purchaseItem) Blockchain data verified: ${JSON.stringify(blockchainData, null, 2)}`,
      );

      // Create a new shop purchase
      const shopPurchase = await this.shopPurchaseModel.create({
        operatorId,
        itemPurchased: shopItemName,
        amount: 1,
        totalCost: blockchainData.txPayload.cost,
        currency: blockchainData.txPayload.curr,
        blockchainData,
      });

      this.logger.debug(
        `(purchaseItem) Shop purchase created: ${JSON.stringify(
          shopPurchase,
          null,
          2,
        )}`,
      );

      // Grant the effects of the shop item to the operator
      await this.grantShopItemEffects(
        operatorId,
        purchaseAllowedResponse.data.shopItemEffects,
      ).catch((err: any) => {
        this.logger.error(
          `(purchaseItem) Error granting shop item effect: ${err.message}`,
        );

        throw new InternalServerErrorException(
          `(purchaseItem) Error granting shop item effect: ${err.message}`,
        );
      });

      this.logger.debug(
        `(purchaseItem) Shop item effects granted to operator ${operatorId}.`,
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
      throw new HttpException(
        `(purchaseItem) Error purchasing item: ${err.message}`,
        err.status || 500,
      );
    }
  }

  /**
   * Grants the operator the effects of a shop item. For example,
   * if the shop item is a drill, we would create a new drill for the operator and update the cumulative EFF of the operator.
   */
  async grantShopItemEffects(
    operatorId: Types.ObjectId,
    shopItemEffects: ShopItemEffects,
  ): Promise<void> {
    try {
      const bulkOperations: any[] = [];

      // Grant a new drill if applicable
      if (shopItemEffects.drillData) {
        let active: boolean = false;

        // If the operator's active drill count is less than their max limit, we
        // can set the new drill as active.
        const operator = await this.operatorModel
          .findOne({ _id: operatorId }, { maxActiveDrillsAllowed: 1 })
          .lean();
        if (!operator) {
          throw new Error(
            `(grantShopItemEffects) Operator with ID ${operatorId} not found`,
          );
        }

        const activeDrillCount = await this.drillModel.countDocuments({
          operatorId,
          active: true,
        });

        if (activeDrillCount < operator.maxActiveDrillsAllowed) {
          active = true;
        }

        const newDrill = new this.drillModel({
          operatorId,
          version: shopItemEffects.drillData.version,
          config: shopItemEffects.drillData.config,
          extractorAllowed: true,
          active,
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

      // First get current operator info to calculate new fuel values
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { currentFuel: 1, maxFuel: 1 })
        .lean();

      if (!operator) {
        throw new Error(`Operator with ID ${operatorId} not found`);
      }

      let newMaxFuel = operator.maxFuel;
      let newCurrentFuel = operator.currentFuel;
      let maxFuelIncreased = false;
      let fuelReplenished = false;
      let maxFuelIncreaseAmount = 0;
      let fuelReplenishedAmount = 0;

      // Increase maxFuel if applicable
      if (
        shopItemEffects.maxFuelIncrease &&
        shopItemEffects.maxFuelIncrease > 0
      ) {
        maxFuelIncreaseAmount = shopItemEffects.maxFuelIncrease;
        newMaxFuel += maxFuelIncreaseAmount;
        maxFuelIncreased = true;

        bulkOperations.push({
          updateOne: {
            filter: { _id: operatorId },
            update: { $inc: { maxFuel: maxFuelIncreaseAmount } },
          },
        });
      }

      // Replenish fuel (without exceeding maxFuel) if applicable
      if (
        shopItemEffects.replenishFuelRatio &&
        shopItemEffects.replenishFuelRatio > 0
      ) {
        const fuelToAdd = newMaxFuel * shopItemEffects.replenishFuelRatio;
        const oldFuel = newCurrentFuel;
        newCurrentFuel = Math.min(newCurrentFuel + fuelToAdd, newMaxFuel);
        fuelReplenishedAmount = newCurrentFuel - oldFuel;
        fuelReplenished = fuelReplenishedAmount > 0;

        if (fuelReplenished) {
          bulkOperations.push({
            updateOne: {
              filter: { _id: operatorId },
              update: { $set: { currentFuel: newCurrentFuel } },
            },
          });
        }
      }

      // Upgrade the operator's max active drill limit if applicable
      if (
        shopItemEffects.upgradedMaxActiveDrillLimit &&
        shopItemEffects.upgradedMaxActiveDrillLimit > 0
      ) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: operatorId },
            update: {
              $set: {
                maxActiveDrillsAllowed:
                  shopItemEffects.upgradedMaxActiveDrillLimit,
              },
            },
          },
        });
      }

      // Execute bulk updates if there are operations to perform
      if (bulkOperations.length > 0) {
        await this.operatorModel.bulkWrite(bulkOperations);
      }

      // Update Redis cache for fuel values if they changed
      if (maxFuelIncreased || fuelReplenished) {
        const operatorFuelCacheKey = `operator:${operatorId.toString()}:fuel`;
        await this.redisService.set(
          operatorFuelCacheKey,
          JSON.stringify({ currentFuel: newCurrentFuel, maxFuel: newMaxFuel }),
          3600, // 1 hour expiry
        );

        // Create notification data
        const operatorUpdate = {
          operatorId,
          currentFuel: newCurrentFuel,
          maxFuel: newMaxFuel,
        };

        // Notify for fuel replenishment if applicable
        if (fuelReplenished) {
          this.logger.log(
            `✅ (grantShopItemEffect) Fuel replenished for operator ${operatorId}: +${fuelReplenishedAmount} units (${newCurrentFuel}/${newMaxFuel})`,
          );

          // Send websocket notification for fuel replenishment
          await this.drillingGatewayService.notifyFuelUpdates(
            [operatorUpdate],
            fuelReplenishedAmount,
            'replenished',
          );
        }

        // Notify for max fuel increase if applicable
        if (
          maxFuelIncreased &&
          (!fuelReplenished || maxFuelIncreaseAmount > fuelReplenishedAmount)
        ) {
          this.logger.log(
            `✅ (grantShopItemEffect) Max fuel increased for operator ${operatorId}: +${maxFuelIncreaseAmount} units (${newCurrentFuel}/${newMaxFuel})`,
          );

          // Send websocket notification for max fuel increase
          // Only notify about max fuel increase if we haven't already notified for replenishment
          // or if the max fuel increase is more significant than the replenishment
          await this.drillingGatewayService.notifyFuelUpdates(
            [operatorUpdate],
            maxFuelIncreaseAmount,
            'replenished',
          );
        }
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

      // ✅ Drill purchase prerequisites check
      if (itemName.includes('drill') && !itemName.includes('upgrade')) {
        this.logger.debug(
          `(checkPurchaseAllowed) Checking prerequisites for drill purchase... `,
        );
        // Fetch all drills and operator data in parallel
        const [operatorDrills, operator] = await Promise.all([
          this.drillModel.find({ operatorId }, { config: 1 }),
          this.operatorModel.findById(operatorId, { maxFuel: 1 }),
        ]);

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

      // If the item is to upgrade max active drill limit
      if (itemName.includes('UPGRADE_MAX_ACTIVE_DRILLS')) {
        this.logger.debug(
          `(checkPurchaseAllowed) Checking prerequisites for max active drill limit upgrade... `,
        );

        // Check the operator's current max active drill limit
        // They can only purchase the value after the current one AND once they have 10 they cannot purchase any at all
        const operator = await this.operatorModel
          .findById(operatorId, { maxActiveDrillsAllowed: 1 })
          .lean();

        if (!operator) {
          return new ApiResponse<{
            purchaseAllowed: boolean;
            reason: string;
          }>(404, `(checkPurchaseAllowed) Operator not found.`, {
            purchaseAllowed: false,
            reason: 'Operator not found.',
          });
        }

        const currentLimit = operator.maxActiveDrillsAllowed;
        const nextLimit = currentLimit + 1;

        // Check if the next limit is greater than the max allowed
        if (currentLimit >= GAME_CONSTANTS.DRILLS.MAX_ACTIVE_DRILLS_ALLOWED) {
          return new ApiResponse<{
            purchaseAllowed: boolean;
            reason: string;
          }>(
            403,
            `(checkPurchaseAllowed) Cannot purchase max active drill limit upgrade. Already at maximum.`,
            {
              purchaseAllowed: false,
              reason: `Already at maximum active drill limit of ${GAME_CONSTANTS.DRILLS.MAX_ACTIVE_DRILLS_ALLOWED}.`,
            },
          );
        }

        // Check if the item name is `UPGRADE_MAX_ACTIVE_DRILLS_(nextLimit)`
        // If not, return an error
        if (!itemName.includes(`UPGRADE_MAX_ACTIVE_DRILLS_${nextLimit}`)) {
          this.logger.error(`
            (checkPurchaseAllowed) Invalid item name for max active drill limit upgrade. 
            Allowed: UPGRADE_MAX_ACTIVE_DRILLS_${nextLimit}, current item: ${itemName}  
          `);

          return new ApiResponse<{
            purchaseAllowed: boolean;
            reason: string;
          }>(
            403,
            `(checkPurchaseAllowed) Cannot purchase max active drill limit upgrade that's not the correct limit.`,
            {
              purchaseAllowed: false,
              reason: `Item name must be UPGRADE_MAX_ACTIVE_DRILLS_${nextLimit}.`,
            },
          );
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
