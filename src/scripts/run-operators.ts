import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OperatorService } from 'src/operators/operator.service';

export async function runOperators() {
  const app = await NestFactory.createApplicationContext(AppModule); // Create NestJS app context
  const operatorService = app.get(OperatorService); // Get service instance

  const result = await operatorService.adminBatchCreateOperators(1000);
  console.log('✅ adminBatchCreateOperators result:', result);

  await app.close(); // Close the app to prevent memory leaks
}

runOperators().catch((err) => {
  console.error('❌ Error running function:', err);
});
