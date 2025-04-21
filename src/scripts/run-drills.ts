import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { DrillService } from 'src/drills/drill.service';

export async function runDrills() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const drillService = app.get(DrillService);

  try {
    await drillService.equityToEffMultiplier(1111);
  } catch (err: any) {
    console.error(err);
  }
}

runDrills().catch((err) => {
  console.error('❌ Error running function:', err);
});
