import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HashbearService } from 'src/hashbear/hashbear.service';

export async function runHashbear() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const hashbearService = app.get(HashbearService);

  const result = await hashbearService.generateCollection(
    'password here',
    5,
  );
  console.log('✅ generateCollection result:', result);

  // await app.close(); // Close the app to prevent memory leaks
}

runHashbear().catch((err) => {
  console.error('❌ Error running function:', err);
});
