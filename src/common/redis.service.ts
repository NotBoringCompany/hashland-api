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
   * Set a value in Redis. Optionally set an expiry in seconds.
   */
  async set(key: string, value: string, expiryInSeconds?: number) {
    if (expiryInSeconds) {
      await this.redis.set(key, value, 'EX', expiryInSeconds);
    } else {
      await this.redis.set(key, value);
    }
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

  /**
   * Scan Redis for keys matching a pattern.
   * @param pattern The pattern to match keys against
   * @param count The number of keys to return per iteration (default: 100)
   * @returns Array of matching keys
   */
  async scanKeys(pattern: string, count: number = 100): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];

    do {
      const [nextCursor, matchedKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );
      cursor = nextCursor;
      keys.push(...matchedKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get multiple values from Redis.
   * @param keys Array of keys to retrieve
   * @returns Array of values (null for non-existent keys)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.redis.mget(keys);
  }

  /**
   * Delete a key from Redis.
   * @param key The key to delete
   * @returns 1 if the key was deleted, 0 if it didn't exist
   */
  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  /**
   * Set multiple key-value pairs in Redis.
   * @param keyValuePairs Object containing key-value pairs
   */
  async mset(keyValuePairs: Record<string, string>): Promise<'OK'> {
    return this.redis.mset(keyValuePairs);
  }
}
