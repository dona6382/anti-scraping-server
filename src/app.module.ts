import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core Modules
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { SecurityModule } from './modules/security/security.module';
import { HealthModule } from './modules/health/health.module';
import { ClientInfoModule } from './modules/client-info/client-info.module';

// New Modular Structure
import { ControllersModule } from './controllers/controllers.module';

// Common
import { CommonModule } from './common/common.module';
import { UnifiedExceptionFilter } from './common/filters/global-exception.filter';

// Main App Controller (simplified)
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Root Application Module
 * 모듈화된 아키텍처로 각 기능이 분리됨
 */
@Module({
  imports: [
    // Configuration (must be first)
    ConfigurationModule,
    
    // Common services and guards  
    CommonModule,
    
    // Feature modules
    SecurityModule,
    HealthModule,
    ClientInfoModule,
    
    // Controllers module (all API endpoints)
    ControllersModule,
  ],
  controllers: [
    // Only the main app controller remains here
    AppController,
  ],
  providers: [
    AppService,
    
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    
    // Global filters
    {
      provide: APP_FILTER,
      useClass: UnifiedExceptionFilter,
    },
  ],
})
export class AppModule {}
