import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

// Configuration
import { ConfigurationModule } from '../modules/configuration/configuration.module';
import { ConfigurationService } from '../modules/configuration/configuration.service';

// Cache
import { CacheFactory, CacheServiceProvider } from './services/cache.factory';

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
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.app.throttle.ttl * 1000,
            limit: config.app.throttle.limit,
          },
        ],
      }),
    }),
  ],
  providers: [
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
