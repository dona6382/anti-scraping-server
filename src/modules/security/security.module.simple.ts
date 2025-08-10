import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

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
    {
      provide: SecurityOrchestrator,
      useFactory: () => {
        const orchestrator = new SecurityOrchestrator();
        
        // Create and register strategies
        const blockedAgents = process.env.BLOCKED_USER_AGENTS?.split(',') || [];
        const strictMode = process.env.SECURITY_STRICT_MODE === 'true';
        const userAgentStrategy = new UserAgentValidationStrategy(blockedAgents, strictMode);
        
        const headlessStrategy = new HeadlessBrowserDetectionStrategy();
        
        const fields = process.env.HONEYPOT_FIELDS?.split(',') || ['email_confirm'];
        const threshold = parseInt(process.env.HONEYPOT_TIME_THRESHOLD || '2000');
        const honeypotStrategy = new HoneypotValidationStrategy(fields, threshold);
        
        // Register all strategies
        orchestrator.registerStrategy(userAgentStrategy);
        orchestrator.registerStrategy(headlessStrategy);
        orchestrator.registerStrategy(honeypotStrategy);
        
        return orchestrator;
      },
    },
    
    // Guards
    UnifiedSecurityGuard,
    IpBlacklistGuard,
    RateLimitGuard,
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
export class SecurityModule {}
