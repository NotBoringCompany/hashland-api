import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ShopItemService } from 'src/shops/shop-item.service';
import { ShopItemType } from 'src/common/enums/shop.enum';

export async function runShopItems() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const shopItemService = app.get(ShopItemService); // Get service instance

  const result = await shopItemService.addShopItem(
    ShopItemType.REPLENISH_FUEL,
    {
      replenishFuelRatio: 1,
    },
    'Replenishes fuel back to max capacity.',
    { ton: 0, bera: 0.95 },
  );
  console.log('✅ addShopItem result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runShopItems().catch((err) => {
  console.error('❌ Error running function:', err);
});
