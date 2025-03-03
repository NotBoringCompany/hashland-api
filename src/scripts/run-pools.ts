import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PoolsService } from '../pools/pools.service';

async function runPools() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const poolsService = app.get(PoolsService); // Get service instance

  const result = await poolsService.createPoolAdmin(
    null,
    'Public Pool 1',
    5000,
  );
  console.log('✅ createPoolAdmin result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runPools().catch((err) => {
  console.error('❌ Error running function:', err);
});
