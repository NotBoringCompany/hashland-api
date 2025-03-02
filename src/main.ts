import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: '*',
  });

  console.log(`Mongo URI: ${process.env.MONGO_URI}`);

  // Start Fastify server
  const PORT = process.env.PORT || 8080;
  await app.listen(PORT, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}
bootstrap();
