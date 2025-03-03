import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Global() // ✅ Makes RedisModule available globally (no need to import in every module)
@Module({
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: async () => {
        if (!process.env.REDIS_URI) {
          throw new Error('❌ REDIS_URI is missing. Check your .env file.');
        }

        const redisUri = new URL(process.env.REDIS_URI);

        const redis = new Redis({
          family: 0,
          host: redisUri.hostname,
          port: parseInt(redisUri.port),
          username: redisUri.username,
          password: redisUri.password,
        });

        redis.on('connect', () => {
          console.log(`✅ Redis Connected: ${process.env.REDIS_URI}`);
        });

        redis.on('error', (err) => {
          console.error(`❌ Redis Error: ${err.message}`);
        });

        return redis;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CONNECTION', RedisService], // Export both connection & service
})
export class RedisModule {}
