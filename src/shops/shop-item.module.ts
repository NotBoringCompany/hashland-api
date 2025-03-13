import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopItem, ShopItemSchema } from './schemas/shop-item.schema';
import { ShopItemService } from './shop-item.service';
import { ShopItemController } from './shop-item.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopItem.name, schema: ShopItemSchema },
    ]), // Register ShopItem schema
  ],
  controllers: [ShopItemController], // Expose API endpoints
  providers: [ShopItemService], // Business logic for ShopItem
  exports: [MongooseModule, ShopItemService], // Allow usage in other modules
})
export class ShopItemModule {}
