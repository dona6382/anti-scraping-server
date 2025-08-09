import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core Modules
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { SecurityModule } from './modules/security/security.module';
import { HealthModule } from './modules/health/health.module';
import { ApiModule } from './api/api.module';

// Common
import { UnifiedExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Controllers
import { AppController } from './app.controller';

// Services
import { AppService } from './app.service';

// Middleware
import { IpBlacklistMiddleware } from './common/middleware/ip-blacklist.middleware';

/**
 * Root Application Module
 * Clean Architecture 적용 및 모든 모듈 통합
 */
@Module({
  imports: [
    // Configuration (최우선 로드)
    ConfigurationModule,
    
    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigurationModule],
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: parseInt(process.env.THROTTLE_TTL || '10') * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT || '20'),
          },
        ],
      }),
    }),
    
    // Feature Modules
    SecurityModule,
    HealthModule,
    ApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: UnifiedExceptionFilter,
    },
    
    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // IP Blacklist Middleware를 모든 경로에 적용
    consumer.apply(IpBlacklistMiddleware).forRoutes('*');
  }
}
