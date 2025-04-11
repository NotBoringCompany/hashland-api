import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DrillingCycleService } from 'src/drills/drilling-cycle.service';

export async function runHashCheck() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const drillingCycleService = app.get(DrillingCycleService); // Get service instance

  const result = await drillingCycleService.checkIssuedHASHData();
  console.log('✅ runHashCheck result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runHashCheck().catch((err) => {
  console.error('❌ Error running function:', err);
});
