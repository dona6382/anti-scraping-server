import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Configuration은 ConfigurationModule에서 이미 글로벌로 제공됨
import { ConfigurationModule } from '../modules/configuration/configuration.module';

// Cache
import { CacheFactory, CacheServiceProvider } from './services/cache.factory';
import { RedisService } from './services/redis.service';
import { MemoryCacheService } from './services/memory-cache.service';
import { RedisCacheService } from './services/redis-cache.service';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';
import { HttpService } from './services/http.service';
import { FingerprintService } from './services/fingerprint/fingerprint.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HoneypotGuard } from './guards/honeypot.guard';
import { RecaptchaGuard } from './guards/recaptcha.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

/**
 * Common Module
 * 공통 서비스, 가드를 제공하는 글로벌 모듈
 */
@Global()
@Module({
  imports: [
    ConfigurationModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_TTL', 10) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 20),
          },
        ],
      }),
    }),
  ],
  providers: [
    // Redis
    RedisService,
    
    // Cache
    CacheFactory,
    CacheServiceProvider,
    
    // Services
    IpBlacklistService,
    HttpService,
    FingerprintService,
    
    // Guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
  ],
  exports: [
    // Export cache
    'ICacheService',
    CacheFactory,
    RedisService,
    
    // Export services
    IpBlacklistService,
    HttpService,
    FingerprintService,
    
    // Export guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    
    // Export modules
    ThrottlerModule,
    ConfigurationModule,
  ],
})
export class CommonModule {}
