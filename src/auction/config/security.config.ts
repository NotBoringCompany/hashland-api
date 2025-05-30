/**
 * Security configuration for auction WebSocket system
 */
export interface SecurityConfig {
  rateLimiting: {
    maxBidAttemptsPerMinute: number;
    maxConnectionAttemptsPerMinute: number;
    rateLimitWindowMs: number;
    cleanupIntervalMs: number;
  };
  authentication: {
    jwtSecret: string;
    tokenExpirationTime: string;
    allowedTokenSources: ('auth' | 'headers' | 'query')[];
  };
  validation: {
    maxBidAmount: number;
    minBidAmount: number;
    maxAuctionDurationHours: number;
    maxWhitelistParticipants: number;
  };
  monitoring: {
    logSecurityEvents: boolean;
    logRateLimitViolations: boolean;
    logConnectionAttempts: boolean;
    logBidAttempts: boolean;
  };
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  rateLimiting: {
    maxBidAttemptsPerMinute: parseInt(
      process.env.MAX_BID_ATTEMPTS_PER_MINUTE || '10',
    ),
    maxConnectionAttemptsPerMinute: parseInt(
      process.env.MAX_CONNECTION_ATTEMPTS_PER_MINUTE || '5',
    ),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    cleanupIntervalMs: parseInt(
      process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || '300000',
    ), // 5 minutes
  },
  authentication: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    tokenExpirationTime: process.env.JWT_EXPIRATION || '24h',
    allowedTokenSources: ['auth', 'headers', 'query'],
  },
  validation: {
    maxBidAmount: parseInt(process.env.MAX_BID_AMOUNT || '1000000'), // 1M HASH
    minBidAmount: parseInt(process.env.MIN_BID_AMOUNT || '1'), // 1 HASH
    maxAuctionDurationHours: parseInt(
      process.env.MAX_AUCTION_DURATION_HOURS || '168',
    ), // 1 week
    maxWhitelistParticipants: parseInt(
      process.env.MAX_WHITELIST_PARTICIPANTS || '1000',
    ),
  },
  monitoring: {
    logSecurityEvents: process.env.LOG_SECURITY_EVENTS === 'true',
    logRateLimitViolations: process.env.LOG_RATE_LIMIT_VIOLATIONS !== 'false', // Default true
    logConnectionAttempts: process.env.LOG_CONNECTION_ATTEMPTS === 'true',
    logBidAttempts: process.env.LOG_BID_ATTEMPTS === 'true',
  },
};

/**
 * Get security configuration with environment overrides
 */
export const getSecurityConfig = (): SecurityConfig => {
  return defaultSecurityConfig;
};

/**
 * Validate security configuration
 */
export const validateSecurityConfig = (config: SecurityConfig): string[] => {
  const errors: string[] = [];

  // Validate rate limiting
  if (config.rateLimiting.maxBidAttemptsPerMinute < 1) {
    errors.push('maxBidAttemptsPerMinute must be at least 1');
  }
  if (config.rateLimiting.maxConnectionAttemptsPerMinute < 1) {
    errors.push('maxConnectionAttemptsPerMinute must be at least 1');
  }
  if (config.rateLimiting.rateLimitWindowMs < 1000) {
    errors.push('rateLimitWindowMs must be at least 1000ms');
  }

  // Validate authentication
  if (
    !config.authentication.jwtSecret ||
    config.authentication.jwtSecret === 'default-secret'
  ) {
    errors.push('JWT secret must be set and not use default value');
  }

  // Validate bid amounts
  if (config.validation.maxBidAmount <= config.validation.minBidAmount) {
    errors.push('maxBidAmount must be greater than minBidAmount');
  }

  return errors;
};
