import { Module, Global, Injectable } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig, RedisConfig, SecurityConfig, ServerConfig, DatabaseConfig } from '../../types/config.types';

/**
 * Configuration validation
 */
function validateConfig(config: Record<string, any>): AppConfig {
  // 필수 환경 변수 검증
  const required: string[] = [];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0 && config.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // 서버 설정
  const serverConfig: ServerConfig = {
    port: parseInt(config.PORT || '3000', 10),
    env: config.NODE_ENV || 'development',
    corsEnabled: config.CORS_ENABLED !== 'false',
    allowedOrigins: config.ALLOWED_ORIGINS
      ? config.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim())
      : [],
    swaggerEnabled: config.NODE_ENV !== 'production' || config.ENABLE_SWAGGER === 'true',
    staticFilesEnabled: config.STATIC_FILES_ENABLED !== 'false',
    logLevel: config.LOG_LEVEL || 'log',
    logPretty: config.LOG_PRETTY === 'true',
  };

  // 보안 설정
  const securityConfig: SecurityConfig = {
    strictMode: config.SECURITY_STRICT_MODE === 'true',
    ipBlacklist: {
      ttl: parseInt(config.IP_BLACKLIST_TTL || '86400', 10),
      maxMemory: parseInt(config.IP_BLACKLIST_MAX_MEMORY || '10000', 10),
    },
    userAgent: {
      blockedAgents: config.BLOCKED_USER_AGENTS
        ? config.BLOCKED_USER_AGENTS.split(',').map((agent: string) => agent.trim())
        : [],
      strictMode: config.SECURITY_STRICT_MODE === 'true',
    },
    honeypot: {
      fieldName: config.HONEYPOT_FIELD_NAME || 'email_confirm',
      timeThreshold: parseInt(config.HONEYPOT_TIME_THRESHOLD || '2000', 10),
    },
    recaptcha: {
      secretKey: config.RECAPTCHA_SECRET_KEY,
      scoreThreshold: parseFloat(config.RECAPTCHA_SCORE_THRESHOLD || '0.5'),
      failOpen: config.RECAPTCHA_FAIL_OPEN === 'true',
      allowedHostnames: config.RECAPTCHA_ALLOWED_HOSTNAMES
        ? config.RECAPTCHA_ALLOWED_HOSTNAMES.split(',').map((host: string) => host.trim())
        : undefined,
    },
    rateLimit: {
      ttl: parseInt(config.THROTTLE_TTL || '10', 10),
      limit: parseInt(config.THROTTLE_LIMIT || '20', 10),
    },
  };

  // Redis 설정 (옵션)
  let redisConfig: RedisConfig | undefined;
  if (config.REDIS_HOST) {
    redisConfig = {
      host: config.REDIS_HOST,
      port: parseInt(config.REDIS_PORT || '6379', 10),
      password: config.REDIS_PASSWORD,
      db: parseInt(config.REDIS_DB || '0', 10),
      family: (parseInt(config.REDIS_FAMILY || '4', 10) as 4 | 6),
      connectionName: config.REDIS_CONNECTION_NAME || 'anti-scraping-server',
      connectTimeout: parseInt(config.REDIS_CONNECT_TIMEOUT || '10000', 10),
      keepAlive: parseInt(config.REDIS_KEEP_ALIVE || '30000', 10),
      noDelay: config.REDIS_NO_DELAY !== 'false',
      maxRetries: parseInt(config.REDIS_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(config.REDIS_RETRY_DELAY || '1000', 10),
      poolMin: parseInt(config.REDIS_POOL_MIN || '2', 10),
      poolMax: parseInt(config.REDIS_POOL_MAX || '10', 10),
      defaultTtl: parseInt(config.REDIS_DEFAULT_TTL || '3600', 10),
      maxItems: parseInt(config.REDIS_MAX_ITEMS || '10000', 10),
      keyPrefix: config.REDIS_KEY_PREFIX || 'anti-scraping:',
      enableOfflineQueue: config.REDIS_ENABLE_OFFLINE_QUEUE !== 'false',
      enableReadyCheck: config.REDIS_ENABLE_READY_CHECK !== 'false',
      lazyConnect: config.REDIS_LAZY_CONNECT === 'true',
      autoPipelining: config.REDIS_AUTO_PIPELINING === 'true',
    };
  }

  const appConfig: AppConfig = {
    server: serverConfig,
    security: securityConfig,
  };

  if (redisConfig) {
    appConfig.redis = redisConfig;
  }

  return appConfig;
}

/**
 * Typed Configuration Service
 */
@Injectable()
export class TypedConfigService {
  private readonly config: AppConfig;

  constructor(private configService: ConfigService) {
    this.config = validateConfig(configService.get<Record<string, any>>('') || {});
  }

  get server(): ServerConfig {
    return this.config.server;
  }

  get security(): SecurityConfig {
    return this.config.security;
  }

  get redis(): RedisConfig | undefined {
    return this.config.redis;
  }

  get database(): DatabaseConfig | undefined {
    return this.config.database;
  }

  isProduction(): boolean {
    return this.config.server.env === 'production';
  }

  isDevelopment(): boolean {
    return this.config.server.env === 'development';
  }

  isTest(): boolean {
    return this.config.server.env === 'test';
  }
}

/**
 * Configuration Module
 * 애플리케이션 설정을 관리하는 모듈
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateConfig,
      cache: true,
    }),
  ],
  providers: [TypedConfigService],
  exports: [ConfigModule, TypedConfigService],
})
export class ConfigurationModule {}
