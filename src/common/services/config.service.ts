import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Simple configuration service using dotenv
 */
@Injectable()
export class ConfigService {
  private readonly envConfig: Record<string, any>;

  constructor() {
    // Load .env file
    const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
    const result = dotenv.config({
      path: path.resolve(process.cwd(), envFile),
    });

    // Fallback to .env if .env.local doesn't exist
    if (result.error && envFile === '.env.local') {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }

    this.envConfig = this.parseConfig();
  }

  /**
   * Parse and structure environment variables
   */
  private parseConfig(): Record<string, any> {
    return {
      app: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',

        throttle: {
          ttl: parseInt(process.env.THROTTLE_TTL || '10', 10),
          limit: parseInt(process.env.THROTTLE_LIMIT || '20', 10),
        },

        redis: {
          host: process.env.REDIS_HOST || '',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0', 10),
        },

        security: {
          strictMode: process.env.SECURITY_STRICT_MODE === 'true',
        },

        blockedUserAgents: process.env.BLOCKED_USER_AGENTS
          ? process.env.BLOCKED_USER_AGENTS.split(',').map((s) => s.trim().toLowerCase())
          : [],

        ipBlacklist: {
          ttl: parseInt(process.env.IP_BLACKLIST_TTL || '86400', 10),
        },

        honeypot: {
          fieldName: process.env.HONEYPOT_FIELD_NAME || 'email_confirm',
        },

        recaptcha: {
          secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
          scoreThreshold: parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || '0.5'),
        },
      },

      redis: this.getRedisConfig(),
    };
  }

  /**
   * Get Redis configuration
   */
  private getRedisConfig(): any {
    return {
      connection: {
        host: process.env.REDIS_HOST || '',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      isConfigured: !!(process.env.REDIS_HOST && process.env.REDIS_HOST !== ''),
      cache: {
        keyPrefix: {
          global: process.env.REDIS_KEY_PREFIX || 'anti-scraping:',
        },
      },
    };
  }

  /**
   * Get configuration value by path
   */
  get<T = any>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let result: any = this.envConfig;

    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) {
        return defaultValue as T;
      }
    }

    return result as T;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.get('app.nodeEnv') === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.get('app.nodeEnv') === 'development';
  }
}
