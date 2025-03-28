import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { ShopPurchaseService } from './shop-purchase.service';
import { isValidObjectId, Types } from 'mongoose';
import {
  PurchaseItemDto,
  PurchaseItemResponseDto,
} from 'src/common/dto/shops/shop-purchase.dto';

@ApiTags('Shop Purchases')
@Controller('shop-purchase')
export class ShopPurchaseController {
  constructor(private readonly shopPurchaseService: ShopPurchaseService) {}

  @ApiOperation({
    summary: 'Purchase an item from the shop',
    description: 'Handles purchasing an item from the shop using TON',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully purchased item',
    type: PurchaseItemResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Invalid transaction, purchase prerequisites not met, or insufficient funds',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Shop item not found',
  })
  @Post()
  async purchaseItem(
    @Body() purchaseItemDto: PurchaseItemDto,
  ): Promise<AppApiResponse<{ shopPurchaseId: string } | null>> {
    // ✅ Validate `operatorId`
    if (!isValidObjectId(purchaseItemDto.operatorId)) {
      throw new BadRequestException(
        `(purchaseItem) Invalid operatorId provided: ${purchaseItemDto.operatorId}`,
      );
    }

    const operatorObjectId = new Types.ObjectId(purchaseItemDto.operatorId);

    // ✅ Validate `shopItemId`
    if (!isValidObjectId(purchaseItemDto.shopItemId)) {
      throw new BadRequestException(
        `(purchaseItem) Invalid shopItemId provided: ${purchaseItemDto.shopItemId}`,
      );
    }
    const shopItemObjectId = new Types.ObjectId(purchaseItemDto.shopItemId);

    // ✅ Ensure `shopItemName` is not empty
    if (
      !purchaseItemDto.shopItemName ||
      purchaseItemDto.shopItemName.trim() === ''
    ) {
      throw new BadRequestException(
        `(purchaseItem) shopItemName is required and cannot be empty.`,
      );
    }

    // ✅ Pass validated values to the service
    return this.shopPurchaseService.purchaseItem(
      operatorObjectId,
      shopItemObjectId,
      purchaseItemDto.shopItemName,
      purchaseItemDto.chain,
      purchaseItemDto.address,
      purchaseItemDto.txHash,
    );
  }
}
