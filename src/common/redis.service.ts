import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CONNECTION') private readonly redis: Redis) {}

  /**
   * Get a value from Redis.
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Set a value in Redis.
   */
  async set(key: string, value: string) {
    await this.redis.set(key, value);
  }

  /**
   * Increment a Redis value (atomic operation).
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    return this.redis.incrby(key, amount);
  }

  /**
   * Reset cycle number in Redis (e.g., for testing or debugging).
   */
  async resetCycleNumber(newCycleNumber: number) {
    await this.redis.set('drilling-cycle:current', newCycleNumber.toString());
    console.warn(`🔄 Drilling Cycle Number Reset to: ${newCycleNumber}`);
  }
}
