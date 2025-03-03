import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ShopDrillsService } from 'src/shops/shop-drill.service';
import { DrillConfig, DrillVersion } from 'src/common/enums/drill.enum';

export async function runShopDrills() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const shopDrillsService = app.get(ShopDrillsService); // Get service instance

  const result = await shopDrillsService.createShopDrill(
    DrillVersion.PREMIUM,
    DrillConfig.IRONBORE,
    5.5,
    15400,
    20,
  );
  console.log('✅ createShopDrill result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runShopDrills().catch((err) => {
  console.error('❌ Error running function:', err);
});
