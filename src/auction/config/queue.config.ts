import { BullModuleOptions } from '@nestjs/bull';

/**
 * Queue configuration interface
 */
export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    connectTimeout: number;
    commandTimeout: number;
  };
  bull: {
    defaultJobOptions: {
      removeOnComplete: number;
      removeOnFail: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
    };
    settings: {
      stalledInterval: number;
      maxStalledCount: number;
    };
  };
  processing: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
    jobTimeout: number;
    batchSize: number;
  };
  priorities: {
    buyNowBid: number;
    endingSoonBid: number;
    regularBid: number;
    lowPriorityBid: number;
  };
}

/**
 * Default queue configuration
 */
export const defaultQueueConfig: QueueConfig = {
  redis: {
    host: process.env.REDIS_QUEUE_HOST || 'localhost',
    port: parseInt(process.env.REDIS_QUEUE_PORT || '6379'),
    password: process.env.REDIS_QUEUE_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB || '1'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
  },
  bull: {
    defaultJobOptions: {
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || '100'),
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '50'),
      attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
      },
    },
    settings: {
      stalledInterval: parseInt(process.env.QUEUE_STALLED_INTERVAL || '30000'),
      maxStalledCount: parseInt(process.env.QUEUE_MAX_STALLED_COUNT || '1'),
    },
  },
  processing: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '5000'),
    jobTimeout: parseInt(process.env.QUEUE_JOB_TIMEOUT || '30000'),
    batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || '50'),
  },
  priorities: {
    buyNowBid: parseInt(process.env.PRIORITY_BUY_NOW || '20'),
    endingSoonBid: parseInt(process.env.PRIORITY_ENDING_SOON || '15'),
    regularBid: parseInt(process.env.PRIORITY_REGULAR || '10'),
    lowPriorityBid: parseInt(process.env.PRIORITY_LOW || '5'),
  },
};

/**
 * Get Bull module configuration
 */
export const getBullConfig = (): BullModuleOptions => {
  const config = defaultQueueConfig;

  return {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      connectTimeout: config.redis.connectTimeout,
      commandTimeout: config.redis.commandTimeout,
    },
    defaultJobOptions: config.bull.defaultJobOptions,
    settings: config.bull.settings,
  };
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  BID_PROCESSING: 'bid-processing',
  NOTIFICATION: 'notification',
  AUCTION_LIFECYCLE: 'auction-lifecycle',
  METRICS: 'metrics',
} as const;

/**
 * Job types
 */
export const JOB_TYPES = {
  PROCESS_BID: 'process-bid',
  SEND_NOTIFICATION: 'send-notification',
  UPDATE_AUCTION_STATUS: 'update-auction-status',
  CALCULATE_METRICS: 'calculate-metrics',
  CLEANUP_EXPIRED: 'cleanup-expired',
} as const;

/**
 * Validate queue configuration
 */
export const validateQueueConfig = (config: QueueConfig): string[] => {
  const errors: string[] = [];

  // Validate Redis configuration
  if (!config.redis.host) {
    errors.push('Redis host is required');
  }
  if (config.redis.port < 1 || config.redis.port > 65535) {
    errors.push('Redis port must be between 1 and 65535');
  }
  if (config.redis.db < 0 || config.redis.db > 15) {
    errors.push('Redis database must be between 0 and 15');
  }

  // Validate processing configuration
  if (config.processing.concurrency < 1) {
    errors.push('Queue concurrency must be at least 1');
  }
  if (config.processing.maxRetries < 0) {
    errors.push('Max retries cannot be negative');
  }
  if (config.processing.jobTimeout < 1000) {
    errors.push('Job timeout must be at least 1000ms');
  }

  // Validate priorities
  const priorities = Object.values(config.priorities);
  if (priorities.some((p) => p < 1 || p > 100)) {
    errors.push('Priority values must be between 1 and 100');
  }

  return errors;
};

/**
 * Get queue configuration with validation
 */
export const getQueueConfig = (): QueueConfig => {
  const config = defaultQueueConfig;
  const errors = validateQueueConfig(config);

  if (errors.length > 0) {
    throw new Error(`Queue configuration errors: ${errors.join(', ')}`);
  }

  return config;
};
