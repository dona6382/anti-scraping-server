import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Core modules
import { CoreModule } from './core/core.module';

// Common modules
import { CommonModule } from './common/common.module';

// API modules
import { ApiModule } from './api/api.module';

// Global filter & guards
import { UnifiedExceptionFilter } from './common/filters/global-exception.filter';
import { IpBlacklistGuard } from './common/guards/ip-blacklist.guard';
import { UserAgentGuard } from './common/guards/user-agent.guard';
import { HeadlessBrowserGuard } from './common/guards/headless-browser.guard';
import { BehavioralGuard } from './common/guards/behavioral.guard';
import { ChallengeGuard } from './common/guards/challenge.guard';

import { AppController } from './app.controller';

/**
 * Root Application Module
 *
 * Clean modular architecture:
 * - Core: Infrastructure (Config, Cache, Types)
 * - Common: Shared components (Guards, Filters, Utils, Services)
 * - API: Versioned API endpoints
 *
 * 전역 보안 체인: ThrottlerGuard → IpBlacklistGuard → Route Guards
 */
@Module({
  imports: [
    CoreModule,
    CommonModule,
    ApiModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    // Global guards (실행 순서: 등록 순서대로)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IpBlacklistGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UserAgentGuard,
    },
    {
      provide: APP_GUARD,
      useClass: HeadlessBrowserGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BehavioralGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ChallengeGuard,
    },

    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: UnifiedExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}