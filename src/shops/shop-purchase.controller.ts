import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { ShopPurchaseService } from './shop-purchase.service';
import { isValidObjectId, Types } from 'mongoose';
import {
  CheckPurchaseAllowedDataDto,
  CheckPurchaseAllowedDto,
  CheckPurchaseAllowedResponseDto,
  PurchaseItemDto,
  PurchaseItemResponseDto,
  ShopPurchaseResponseDto,
} from 'src/common/dto/shops/shop-purchase.dto';

@ApiTags('Shop Purchases')
@Controller('shop-purchase')
export class ShopPurchaseController {
  constructor(private readonly shopPurchaseService: ShopPurchaseService) {}

  @ApiOperation({
    summary: 'Purchase an item from the shop',
    description:
      'Handles purchasing an item from the shop using cryptocurrency',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully purchased item',
    type: PurchaseItemResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
    type: PurchaseItemResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Invalid transaction, purchase prerequisites not met, or insufficient funds',
    type: PurchaseItemResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Shop item not found',
    type: PurchaseItemResponseDto,
  })
  @Post()
  async purchaseItem(
    @Body() purchaseItemDto: PurchaseItemDto,
  ): Promise<AppApiResponse<ShopPurchaseResponseDto | null>> {
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

  @ApiOperation({
    summary: 'Check if a purchase is allowed',
    description:
      'Checks if the operator meets all prerequisites for purchasing an item',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully checked purchase prerequisites',
    type: CheckPurchaseAllowedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
    type: CheckPurchaseAllowedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Shop item not found',
    type: CheckPurchaseAllowedResponseDto,
  })
  @Post('check-prerequisites')
  async checkPurchaseAllowed(
    @Body() checkPurchaseAllowedDto: CheckPurchaseAllowedDto,
  ): Promise<AppApiResponse<CheckPurchaseAllowedDataDto | null>> {
    // ✅ Validate `operatorId`
    if (!isValidObjectId(checkPurchaseAllowedDto.operatorId)) {
      throw new BadRequestException(
        `(checkPurchaseAllowed) Invalid operatorId provided: ${checkPurchaseAllowedDto.operatorId}`,
      );
    }

    const operatorObjectId = new Types.ObjectId(
      checkPurchaseAllowedDto.operatorId,
    );

    // ✅ Validate `shopItemId` if provided
    let shopItemObjectId: Types.ObjectId | undefined;
    if (checkPurchaseAllowedDto.shopItemId) {
      if (!isValidObjectId(checkPurchaseAllowedDto.shopItemId)) {
        throw new BadRequestException(
          `(checkPurchaseAllowed) Invalid shopItemId provided: ${checkPurchaseAllowedDto.shopItemId}`,
        );
      }
      shopItemObjectId = new Types.ObjectId(checkPurchaseAllowedDto.shopItemId);
    }

    // ✅ Pass validated values to the service
    return this.shopPurchaseService.checkPurchaseAllowed(
      operatorObjectId,
      checkPurchaseAllowedDto.showShopItemEffects ?? false,
      checkPurchaseAllowedDto.showShopItemPrice ?? false,
      shopItemObjectId,
      checkPurchaseAllowedDto.shopItemName,
    );
  }
}
