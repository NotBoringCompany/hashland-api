import { Module, Global, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Global() // ✅ Makes RedisModule available globally (no need to import in every module)
@Module({
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: async () => {
        const logger = new Logger('RedisModule');

        if (!process.env.REDIS_URI) {
          throw new Error('❌ REDIS_URI is missing. Check your .env file.');
        }

        logger.log(
          `Attempting to connect to Redis with URI: ${process.env.REDIS_URI}`,
        );

        try {
          const redisUri = new URL(process.env.REDIS_URI);

          logger.log(
            `Redis connection details: host=${redisUri.hostname}, port=${redisUri.port}`,
          );

          const redis = new Redis({
            family: 0, // added family: 0 for IPv4 and IPv6 support
            host: redisUri.hostname,
            port: parseInt(redisUri.port) || 6379,
            username: redisUri.username || undefined,
            password: redisUri.password || undefined,
            connectTimeout: 10000, // 10 seconds
            retryStrategy: (times) => {
              const delay = Math.min(times * 1000, 5000);
              logger.warn(
                `Redis connection attempt ${times} failed. Retrying in ${delay}ms...`,
              );
              return delay;
            },
          });

          redis.on('connect', () => {
            logger.log(
              `✅ Redis Connected: ${redisUri.hostname}:${redisUri.port}`,
            );
          });

          redis.on('error', (err) => {
            logger.error(`❌ Redis Error: ${err.message}`);
            logger.error(`Error details: ${JSON.stringify(err)}`);
            if (err && typeof err === 'object' && 'code' in err) {
              logger.error(`Error code: ${(err as any).code}`);
            }
          });

          redis.on('close', () => {
            logger.warn('⚠️ Redis connection closed');
          });

          redis.on('reconnecting', (time) => {
            logger.warn(`⚠️ Redis reconnecting, attempt: ${time}`);
          });

          return redis;
        } catch (error) {
          logger.error(
            `❌ Failed to initialize Redis connection: ${error.message}`,
          );
          logger.error(`Stack trace: ${error.stack}`);
          throw error;
        }
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CONNECTION', RedisService], // Export both connection & service
})
export class RedisModule {}
