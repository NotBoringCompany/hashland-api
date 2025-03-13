import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';
import { ShopItemService } from 'src/shops/shop-item.service';
import { ShopItemType } from 'src/common/enums/shop.enum';

export async function runShopItems() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const shopItemService = app.get(ShopItemService); // Get service instance

  const result = await shopItemService.addShopItem(
    ShopItemType.DREADNOUGHT_DRILL,
    {
      drillData: {
        version: DrillVersion.PREMIUM,
        config: DrillConfig.DREADNOUGHT,
        baseEff: 440000,
        maxLevel: 20,
      },
    },
    'The ultimate drilling machine providing top-tier EFF, offering maximum durability and power.',
    635,
  );
  console.log('✅ addShopItem result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runShopItems().catch((err) => {
  console.error('❌ Error running function:', err);
});
