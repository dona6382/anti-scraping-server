import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Configuration Service
 * 통합된 설정 서비스
 */
@Injectable()
export class ConfigurationService {
  constructor(private readonly nestConfigService: NestConfigService) {}

  /**
   * 설정 값 가져오기
   */
  get<T = any>(key: string, defaultValue?: T): T {
    // 중첩된 키 지원 (예: 'app.security.strictMode')
    const keys = key.split('.');
    let value: any = this.nestConfigService.get(keys[0] || key);
    
    for (let i = 1; i < keys.length; i++) {
      if (value && typeof value === 'object' && keys[i]) {
        value = value[keys[i] as keyof typeof value];
      } else {
        value = undefined;
        break;
      }
    }
    
    // 환경 변수에서 직접 가져오기 시도
    if (value === undefined) {
      value = this.nestConfigService.get(key);
    }
    
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * 필수 설정 값 가져오기
   */
  getOrThrow<T = any>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" is required but not found`);
    }
    return value;
  }

  /**
   * 설정 값 존재 여부 확인
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * 여러 설정 값 가져오기
   */
  getMany<T = any>(keys: string[]): Record<string, T> {
    const result: Record<string, T> = {};
    for (const key of keys) {
      result[key] = this.get<T>(key);
    }
    return result;
  }

  /**
   * 환경 확인
   */
  get isDevelopment(): boolean {
    return this.get('NODE_ENV', 'development') === 'development';
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }

  /**
   * 애플리케이션 설정
   */
  get app() {
    return {
      port: this.get<number>('app.port', 3000),
      nodeEnv: this.get<string>('app.nodeEnv', 'development'),
      security: {
        strictMode: this.get<boolean>('app.security.strictMode', false),
      },
      throttle: {
        ttl: this.get<number>('app.throttle.ttl', 10),
        limit: this.get<number>('app.throttle.limit', 20),
      },
      recaptcha: {
        secretKey: this.get<string>('app.recaptcha.secretKey', ''),
        scoreThreshold: this.get<number>('app.recaptcha.scoreThreshold', 0.5),
        failOpen: this.get<boolean>('app.recaptcha.failOpen', false),
        allowedHostnames: this.get<string[]>('app.recaptcha.allowedHostnames', []),
      },
      ipBlacklist: {
        ttl: this.get<number>('app.ipBlacklist.ttl', 86400),
        maxMemorySize: this.get<number>('app.ipBlacklist.maxMemorySize', 10000),
      },
      blockedUserAgents: this.get<string[]>('app.blockedUserAgents', []),
      honeypot: {
        fieldName: this.get<string>('app.honeypot.fieldName', 'email_confirm'),
        timeThreshold: this.get<number>('app.honeypot.timeThreshold', 2000),
      },
      logging: {
        level: this.get<string>('app.logging.level', 'debug'),
        prettyPrint: this.get<boolean>('app.logging.prettyPrint', true),
      },
    };
  }

  /**
   * Redis 설정
   */
  get redis() {
    return {
      host: this.get<string>('redis.connection.host', 'localhost'),
      port: this.get<number>('redis.connection.port', 6379),
      password: this.get<string>('redis.connection.password'),
      db: this.get<number>('redis.connection.db', 0),
      isConfigured: this.get<boolean>('redis.isConfigured', false),
      cache: {
        ttl: this.get<number>('redis.cache.ttl', 3600),
        keyPrefix: {
          global: this.get<string>('redis.cache.keyPrefix.global', 'anti-scraping:'),
          blacklist: this.get<string>('redis.cache.keyPrefix.blacklist', 'blacklist:'),
          rateLimit: this.get<string>('redis.cache.keyPrefix.rateLimit', 'rate-limit:'),
        },
      },
    };
  }
}
