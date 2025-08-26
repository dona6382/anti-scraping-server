import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Core modules
import { CoreModule } from './core/core.module';

// Common modules
import { CommonModule } from './common/common.module';

// API modules
import { ApiModule } from './api/api.module';

// Global filter
import { UnifiedExceptionFilter } from './common/filters/global-exception.filter';

// App controller and service
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Root Application Module
 * 
 * Clean modular architecture:
 * - Core: Infrastructure (Config, Cache, Types)
 * - Common: Shared components (Guards, Filters, Utils, Services)
 * - API: Versioned API endpoints
 */
@Module({
  imports: [
    // Core infrastructure (must be first)
    CoreModule,
    
    // Common services and components
    CommonModule,
    
    // API modules
    ApiModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: UnifiedExceptionFilter,
    },
  ],
})
export class AppModule {}