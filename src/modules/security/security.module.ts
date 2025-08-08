import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

// Core Services
import { SecurityOrchestrator } from '../../core/application/services/security-orchestrator.service';
import { IpManagementService } from '../../core/application/services/ip-management.service';

// Strategies
import {
  UserAgentValidationStrategy,
  HeadlessBrowserDetectionStrategy,
  HoneypotValidationStrategy,
} from '../../core/application/services/security-orchestrator.service';

// Guards
import {
  UnifiedSecurityGuard,
  IpBlacklistGuard,
  RateLimitGuard,
} from './security.guard';

// Adapters
import {
  RedisCacheAdapter,
  MemoryCacheAdapter,
} from '../../core/infrastructure/adapters/cache.adapter';

// Controllers
import { SecurityAdminController } from './security-admin.controller';

/**
 * Security Module
 * 모든 보안 관련 기능을 제공하는 모듈
 */
@Global()
@Module({
  imports: [],
  controllers: [SecurityAdminController],
  providers: [
    // Core Services
    {
      provide: 'IIpValidationService',
      useClass: IpManagementService,
    },
    {
      provide: 'ICache',
      useFactory: () => {
        const redisHost = process.env.REDIS_HOST;
        if (redisHost) {
          return new RedisCacheAdapter({
            host: redisHost,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            keyPrefix: 'anti-scraping:',
          });
        }
        return new MemoryCacheAdapter({
          maxSize: 10000,
          ttl: 3600,
        });
      },
    },
    
    // Security Orchestrator
    SecurityOrchestrator,
    
    // Security Strategies
    {
      provide: 'UserAgentStrategy',
      useFactory: () => {
        const blockedAgents = process.env.BLOCKED_USER_AGENTS?.split(',') || [];
        const strictMode = process.env.SECURITY_STRICT_MODE === 'true';
        return new UserAgentValidationStrategy(blockedAgents, strictMode);
      },
    },
    {
      provide: 'HeadlessStrategy',
      useValue: new HeadlessBrowserDetectionStrategy(),
    },
    {
      provide: 'HoneypotStrategy',
      useFactory: () => {
        const fields = process.env.HONEYPOT_FIELDS?.split(',') || ['email_confirm'];
        const threshold = parseInt(process.env.HONEYPOT_TIME_THRESHOLD || '2000');
        return new HoneypotValidationStrategy(fields, threshold);
      },
    },
    
    // Guards
    UnifiedSecurityGuard,
    IpBlacklistGuard,
    RateLimitGuard,
    
    // Global Guard (optional - can be configured per route instead)
    // {
    //   provide: APP_GUARD,
    //   useClass: UnifiedSecurityGuard,
    // },
  ],
  exports: [
    'IIpValidationService',
    'ICache',
    SecurityOrchestrator,
    UnifiedSecurityGuard,
    IpBlacklistGuard,
    RateLimitGuard,
  ],
})
export class SecurityModule {
  constructor(
    private readonly orchestrator: SecurityOrchestrator,
    private readonly userAgentStrategy: UserAgentValidationStrategy,
    private readonly headlessStrategy: HeadlessBrowserDetectionStrategy,
    private readonly honeypotStrategy: HoneypotValidationStrategy,
  ) {
    // Register all strategies
    this.orchestrator.registerStrategy(this.userAgentStrategy);
    this.orchestrator.registerStrategy(this.headlessStrategy);
    this.orchestrator.registerStrategy(this.honeypotStrategy);
  }
}
