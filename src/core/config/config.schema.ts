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

// Basic validation function (without Joi for now)
export function validateConfig(): AppConfig {
  const config = process.env;
  
  // Basic validation
  if (config.NODE_ENV && !['development', 'production', 'test'].includes(config.NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${config.NODE_ENV}`);
  }

  return configFactory();
}

export const configFactory = (): AppConfig => ({
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  security: {
    strictMode: process.env.SECURITY_STRICT_MODE === 'true',
    rateLimit: {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '20', 10),
    },
    ipBlacklist: {
      ttl: parseInt(process.env.IP_BLACKLIST_TTL || '86400', 10),
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
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'anti_scraping',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
});
