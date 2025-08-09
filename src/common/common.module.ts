import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Configuration
import { ConfigurationModule } from '../modules/configuration/configuration.module';
import { ConfigurationService } from '../modules/configuration/configuration.service';

// Cache
import { CacheFactory, CacheServiceProvider } from './services/cache.factory';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';
import { HttpService } from './services/http.service';
import { HealthService } from './services/health.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HoneypotGuard } from './guards/honeypot.guard';
import { RecaptchaGuard } from './guards/recaptcha.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

// Middleware
import { IpBlacklistMiddleware } from './middleware/ip-blacklist.middleware';

// Legacy Config Service (for backward compatibility)
import { ConfigService } from './services/config.service';

// Event Bus
import { EventBusService } from './events/event-bus.service';

/**
 * Common Module
 * 공통 서비스, 가드, 미들웨어를 제공하는 글로벌 모듈
 */
@Global()
@Module({
  imports: [
    ConfigurationModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
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
    
    // Event Bus
    EventBusService,
    
    // Services
    IpBlacklistService,
    HttpService,
    HealthService,
    
    // Guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    
    // Middleware
    IpBlacklistMiddleware,
    
    // Legacy Config Service (wraps ConfigurationService)
    {
      provide: ConfigService,
      useFactory: (configurationService: ConfigurationService) => {
        return {
          get: (key: string, defaultValue?: any) => configurationService.get(key, defaultValue),
          getOrThrow: (key: string) => configurationService.getOrThrow(key),
          has: (key: string) => configurationService.has(key),
        };
      },
      inject: [ConfigurationService],
    },
  ],
  exports: [
    // Export cache
    'ICacheService',
    CacheFactory,
    
    // Export event bus
    EventBusService,
    
    // Export services
    IpBlacklistService,
    HttpService,
    HealthService,
    
    // Export guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    
    // Export middleware
    IpBlacklistMiddleware,
    
    // Export modules
    ThrottlerModule,
    ConfigurationModule,
    
    // Export config service
    ConfigService,
  ],
})
export class CommonModule {}
