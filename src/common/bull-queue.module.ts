import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { BullQueueService } from './bull-queue.service';

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
          redis: `${process.env.REDIS_URI + '?family=0'}`, // `family=0` forces IPv4 and IPv6 lookup
        };
      },
    }),
    BullModule.registerQueue({ name: 'drilling-cycles' }), // Registers the queue
  ],
  providers: [BullQueueService], // Provides BullQueueService
  exports: [BullModule, BullQueueService], // Allow other modules to use Bull queues
})
export class BullQueueModule {}
