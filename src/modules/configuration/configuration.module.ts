import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';

/**
 * 간소화된 앱 설정
 */
const appConfig = () => ({
  app: {
    name: 'Anti-Scraping Server',
    version: '1.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
    },
    security: {
      strictMode: process.env.SECURITY_STRICT_MODE === 'true',
      honeypotField: process.env.HONEYPOT_FIELD || 'email_confirm',
      honeypotTimeThreshold: parseInt(process.env.HONEYPOT_TIME_THRESHOLD, 10) || 2000,
    },
  },
});

/**
 * 간소화된 Redis 설정
 */
const redisConfig = () => ({
  redis: {
    host: process.env.REDIS_HOST || null,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'anti-scraping:',
    ttl: parseInt(process.env.REDIS_TTL, 10) || 86400,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 1000,
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY, 10) || 1000,
  },
});

/**
 * PostgreSQL 데이터베이스 설정
 */
const databaseConfig = () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'p_user',
    password: process.env.DB_PASSWORD || 'p_pw',
    name: process.env.DB_NAME || 'p_db',
    ssl: {
      enabled: process.env.DB_SSL_ENABLED === 'true',
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 10,
      min: parseInt(process.env.DB_MIN_CONNECTIONS, 10) || 2,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT, 10) || 60000,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 10000,
    },
    query: {
      timeout: parseInt(process.env.DB_QUERY_TIMEOUT, 10) || 30000,
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 30000,
    },
    logging: {
      enabled: process.env.DB_LOGGING === 'true',
      logQueries: process.env.DB_LOG_QUERIES === 'true',
    },
  },
});

/**
 * Configuration Module
 * 애플리케이션 설정을 중앙 관리
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, redisConfig, databaseConfig],
      envFilePath: ['.env', '.env.local', `.env.${process.env.NODE_ENV}`],
    }),
  ],
  providers: [
    ConfigurationService,
    {
      provide: 'ConfigService', // Legacy support
      useExisting: ConfigurationService,
    },
  ],
  exports: [ConfigurationService, 'ConfigService', ConfigModule],
})
export class ConfigurationModule {}
