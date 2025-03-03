import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { BullQueueService } from './bull-queue.service';
import { RedisModule } from './redis.module';

/**
 * `BullQueueModule` initializes the Redis connection for Bull job queues.
 */
@Module({
  imports: [
    ConfigModule, // ✅ Ensure environment variables are loaded
    BullModule.forRootAsync({
      imports: [ConfigModule, RedisModule], // Inject RedisModule for Redis configuration
      useFactory: async () => {
        if (!process.env.REDIS_URI) {
          throw new Error('❌ REDIS_URI is missing. Check your .env file.');
        }

        const redisUri = new URL(process.env.REDIS_URI);

        return {
          redis: {
            family: 0,
            host: redisUri.hostname,
            port: parseInt(redisUri.port),
            username: redisUri.username,
            password: redisUri.password,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: 'drilling-cycles' }), // Registers the queue
  ],
  providers: [BullQueueService], // Provides BullQueueService
  exports: [BullModule, BullQueueService], // Allow other modules to use Bull queues
})
export class BullQueueModule {}
