import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';

/**
 * `BullQueueModule` initializes the Redis connection for Bull job queues.
 */
@Module({
  imports: [
    ConfigModule, // ✅ Ensure environment variables are loaded
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async () => {
        if (!process.env.REDIS_URI) {
          throw new Error('❌ REDIS_URI is missing. Check your .env file.');
        }

        return {
          redis: `${process.env.REDIS_URI}`,
        };
      },
    }),
  ],
  exports: [BullModule], // ✅ Allow other modules to use Bull queues
})
export class BullQueueModule {}
