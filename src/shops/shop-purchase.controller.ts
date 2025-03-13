import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ShopPurchaseService } from './shop-purchase.service';
import { isValidObjectId, Types } from 'mongoose';

@Controller('shop-purchase') // Base route: `/shop-purchase`
export class ShopPurchaseController {
  constructor(private readonly shopPurchaseService: ShopPurchaseService) {}

  /**
   * POST `/`
   * Handles purchasing an item from the shop.
   */
  @Post()
  async purchaseItem(
    @Body('operatorId') operatorId: string,
    @Body('shopItemId') shopItemId: string,
    @Body('shopItemName') shopItemName: string,
    @Body('address') address: string,
    @Body('boc') boc: string,
  ): Promise<ApiResponse<{ shopPurchaseId: string } | null>> {
    // ✅ Validate `operatorId`
    if (!isValidObjectId(operatorId)) {
      throw new BadRequestException(
        `(purchaseItem) Invalid operatorId provided: ${operatorId}`,
      );
    }

    const operatorObjectId = new Types.ObjectId(operatorId);

    // ✅ Validate `shopItemId`
    if (!isValidObjectId(shopItemId)) {
      throw new BadRequestException(
        `(purchaseItem) Invalid shopItemId provided: ${shopItemId}`,
      );
    }
    const shopItemObjectId = new Types.ObjectId(shopItemId);

    // ✅ Ensure `shopItemName` is not empty
    if (!shopItemName || shopItemName.trim() === '') {
      throw new BadRequestException(
        `(purchaseItem) shopItemName is required and cannot be empty.`,
      );
    }

    // ✅ Pass validated values to the service
    return this.shopPurchaseService.purchaseItem(
      operatorObjectId,
      shopItemObjectId,
      shopItemName,
      address,
      boc,
    );
  }
}
