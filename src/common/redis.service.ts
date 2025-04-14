import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 100; // ms

  constructor(@Inject('REDIS_CONNECTION') private readonly redis: Redis) {
    // Setup event listeners for Redis connection
    this.setupRedisEventListeners();
  }

  /**
   * Setup Redis event listeners to monitor connection
   */
  private setupRedisEventListeners() {
    this.redis.on('error', (error) => {
      this.logger.error(`❌ Redis connection error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Redis connected successfully');
    });

    this.redis.on('reconnecting', () => {
      this.logger.warn('⚠️ Redis reconnecting...');
    });

    this.redis.on('ready', () => {
      this.logger.log('✅ Redis connection ready');
    });
  }

  /**
   * Generic retry wrapper for Redis operations
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    methodName: string,
  ): Promise<T> {
    let lastError: Error;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Redis ${methodName} attempt ${attempt} failed: ${error.message}`,
        );

        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * attempt),
          );
        }
      }
    }

    this.logger.error(
      `Redis ${methodName} failed after ${this.maxRetries} attempts`,
    );
    throw lastError;
  }

  /**
   * Get a value from Redis.
   */
  async get(key: string): Promise<string | null> {
    return this.retryOperation(() => this.redis.get(key), 'get');
  }

  /**
   * Set a value in Redis. Optionally set an expiry in seconds.
   */
  async set(key: string, value: string, expiryInSeconds?: number) {
    return this.retryOperation(async () => {
      if (expiryInSeconds) {
        return await this.redis.set(key, value, 'EX', expiryInSeconds);
      } else {
        return await this.redis.set(key, value);
      }
    }, 'set');
  }

  /**
   * Increment a Redis value (atomic operation).
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    return this.retryOperation(
      () => this.redis.incrby(key, amount),
      'increment',
    );
  }

  /**
   * Reset cycle number in Redis (e.g., for testing or debugging).
   */
  async resetCycleNumber(newCycleNumber: number) {
    await this.set('drilling-cycle:current', newCycleNumber.toString());
    this.logger.warn(`🔄 Drilling Cycle Number Reset to: ${newCycleNumber}`);
  }

  /**
   * Flush all keys in Redis (use with caution).
   */
  async flushAll() {
    return this.redis.flushall();
  }

  /**
   * Scan Redis for keys matching a pattern.
   * @param pattern The pattern to match keys against
   * @param count The number of keys to return per iteration (default: 100)
   * @returns Array of matching keys
   */
  async scanKeys(pattern: string, count: number = 100): Promise<string[]> {
    return this.retryOperation(async () => {
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
    }, 'scanKeys');
  }

  /**
   * Get multiple values from Redis.
   * @param keys Array of keys to retrieve
   * @returns Array of values (null for non-existent keys)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.retryOperation(() => this.redis.mget(keys), 'mget');
  }

  /**
   * Delete a key from Redis.
   * @param key The key to delete
   * @returns 1 if the key was deleted, 0 if it didn't exist
   */
  async del(key: string): Promise<number> {
    return this.retryOperation(() => this.redis.del(key), 'del');
  }

  /**
   * Set multiple key-value pairs in Redis.
   * @param keyValuePairs Object containing key-value pairs
   */
  async mset(keyValuePairs: Record<string, string>): Promise<'OK'> {
    return this.retryOperation(() => this.redis.mset(keyValuePairs), 'mset');
  }
}
