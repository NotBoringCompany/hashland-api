import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ShopPurchase,
  ShopPurchaseSchema,
} from './schemas/shop-purchase.schema';
import { ShopPurchaseService } from './shop-purchase.service';
import { TonModule } from 'src/ton/ton.module';
import { ShopItem, ShopItemSchema } from './schemas/shop-item.schema';
import { Drill, DrillSchema } from 'src/drills/schemas/drill.schema';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import { ShopPurchaseController } from './shop-purchase.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopPurchase.name, schema: ShopPurchaseSchema },
      { name: ShopItem.name, schema: ShopItemSchema },
      { name: Drill.name, schema: DrillSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]), // Register ShopPurchase schema
    TonModule,
  ],
  controllers: [ShopPurchaseController], // Expose API endpoints
  providers: [ShopPurchaseService], // Business logic for ShopService
  exports: [MongooseModule, ShopPurchaseService], // Allow usage in other modules
})
export class ShopPurchaseModule {}
