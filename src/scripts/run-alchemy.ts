import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AlchemyService } from 'src/alchemy/alchemy.service';

export async function runAlchemy() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const alchemyService = app.get(AlchemyService);

  const result = await alchemyService.getEligibleTokenBalances(
    '0x50415B9D886892Be314f5CbAF600C3a4B625CBE5',
  );
  console.log('✅ getTokenBalances result:', result);

  // await app.close(); // Close the app to prevent memory leaks
}

runAlchemy().catch((err) => {
  console.error('❌ Error running function:', err);
});
