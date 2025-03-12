import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopItem, ShopItemSchema } from './schemas/shop-item.schema';
import { ShopItemService } from './shop-item.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopItem.name, schema: ShopItemSchema },
    ]), // Register ShopItem schema
  ],
  controllers: [], // Expose API endpoints
  providers: [ShopItemService], // Business logic for ShopItem
  exports: [MongooseModule, ShopItemService], // Allow usage in other modules
})
export class ShopItemModule {}
