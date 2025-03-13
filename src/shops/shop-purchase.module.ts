import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ShopPurchase,
  ShopPurchaseSchema,
} from './schemas/shop-purchase.schema';
import { ShopPurchaseService } from './shop-purchase.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopPurchase.name, schema: ShopPurchaseSchema },
    ]), // Register ShopPurchase schema
  ],
  controllers: [], // Expose API endpoints
  providers: [ShopPurchaseService], // Business logic for ShopService
  exports: [MongooseModule, ShopPurchaseService], // Allow usage in other modules
})
export class ShopPurchaseModule {}
