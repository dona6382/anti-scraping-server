// src/core/config/config.schema.ts

export interface AppConfig {
  server: {
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
    corsOrigins: string[];
  };
  security: {
    strictMode: boolean;
    rateLimit: {
      ttl: number;
      limit: number;
    };
    ipBlacklist: {
      ttl: number;
      enabled: boolean;
    };
    userAgent: {
      blockedAgents: string[];
      strictMode: boolean;
    };
    honeypot: {
      fieldName: string;
      enabled: boolean;
    };
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
  };
}

/** Parse integer from env with validation */
function safeParseInt(value: string | undefined, fallback: number, name: string, min?: number, max?: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer for ${name}: "${value}"`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`${name} must be >= ${min}, got ${parsed}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`${name} must be <= ${max}, got ${parsed}`);
  }
  return parsed;
}

// Basic validation function (without Joi for now)
export function validateConfig(): AppConfig {
  const config = process.env;

  // Basic validation
  if (config.NODE_ENV && !['development', 'production', 'test'].includes(config.NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${config.NODE_ENV}`);
  }

  // Production-only: require secrets
  if (config.NODE_ENV === 'production') {
    if (!config.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
    if (!config.CHALLENGE_SECRET) throw new Error('CHALLENGE_SECRET is required in production');
    if (!config.PUZZLE_SECRET) throw new Error('PUZZLE_SECRET is required in production');
  }

  // Validate integer env vars early (with range checks for ports)
  safeParseInt(config.PORT, 3000, 'PORT', 1, 65535);
  safeParseInt(config.REDIS_PORT, 6379, 'REDIS_PORT', 1, 65535);
  safeParseInt(config.DB_PORT, 5432, 'DB_PORT', 1, 65535);
  safeParseInt(config.THROTTLE_TTL, 60, 'THROTTLE_TTL', 1);
  safeParseInt(config.THROTTLE_LIMIT, 20, 'THROTTLE_LIMIT', 1);

  return configFactory();
}

export const configFactory = (): AppConfig => ({
  server: {
    port: safeParseInt(process.env.PORT, 3000, 'PORT', 1, 65535),
    nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:3000'],
  },
  security: {
    strictMode: process.env.SECURITY_STRICT_MODE === 'true',
    rateLimit: {
      ttl: safeParseInt(process.env.THROTTLE_TTL, 60, 'THROTTLE_TTL'),
      limit: safeParseInt(process.env.THROTTLE_LIMIT, 20, 'THROTTLE_LIMIT'),
    },
    ipBlacklist: {
      ttl: safeParseInt(process.env.IP_BLACKLIST_TTL, 86400, 'IP_BLACKLIST_TTL'),
      enabled: process.env.IP_BLACKLIST_ENABLED !== 'false',
    },
    userAgent: {
      blockedAgents: process.env.BLOCKED_USER_AGENTS?.split(',') ||
        ['scrapy', 'python-requests', 'go-http-client', 'httpclient'],
      strictMode: process.env.USER_AGENT_STRICT_MODE === 'true',
    },
    honeypot: {
      fieldName: process.env.HONEYPOT_FIELD_NAME || 'email_confirm',
      enabled: process.env.HONEYPOT_ENABLED !== 'false',
    },
  },
  redis: {
    host: process.env.REDIS_HOST || '',
    port: safeParseInt(process.env.REDIS_PORT, 6379, 'REDIS_PORT', 1, 65535),
    password: process.env.REDIS_PASSWORD,
    db: safeParseInt(process.env.REDIS_DB, 0, 'REDIS_DB'),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: safeParseInt(process.env.DB_PORT, 5432, 'DB_PORT', 1, 65535),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'anti_scraping',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
});
