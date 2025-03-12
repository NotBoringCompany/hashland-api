import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ShopPurchase } from './schemas/shop-purchase.schema';
import { Model } from 'mongoose';

@Injectable()
export class ShopPurchasesService {
  constructor(
    @InjectModel(ShopPurchase.name)
    private readonly shopPurchaseModel: Model<ShopPurchase>,
  ) {}
}
