import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/winston.config';
import { ValidationPipe } from '@nestjs/common';

// ✅ Ensure logs folder exists before Winston tries to write to it
import * as fs from 'fs';
import * as path from 'path';

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  console.log(`Creating logs folder: ${logDir}`);
  fs.mkdirSync(logDir, { recursive: true });
} else {
  console.log(`Logs folder exists: ${logDir}`);
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      logger: WinstonModule.createLogger(winstonConfig),
    },
  );

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register ValidationPipe for automatic DTO validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Transform payloads to DTO instances
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: false, // Throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: false, // Don't convert implicitly, use @Type() decorators
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  });

  // Use the Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HashLand API')
    .setDescription(`Hashland's API Documentation`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Start Fastify server
  const PORT = process.env.PORT || 8080;
  await app.listen(PORT, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(
    `📚 Swagger documentation available at http://localhost:${PORT}/api/docs`,
  );
}
bootstrap();
