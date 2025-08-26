// src/core/core.module.ts
import { Module, Global } from '@nestjs/common';
import { CoreConfigModule } from './config/config.module';
import { CoreCacheModule } from './cache/cache.module';
import { CoreDatabaseModule } from './database/database.module';

/**
 * Global Core Module
 * 
 * 이 모듈은 전체 애플리케이션에서 사용되는 핵심 서비스들을 포함합니다:
 * - Configuration 관리
 * - Database 연결
 * - Cache (Redis) 연결
 * - 로깅 시스템
 */
@Global()
@Module({
  imports: [
    CoreConfigModule,
    CoreCacheModule,
    CoreDatabaseModule,
    // TODO: Add Logger Module
  ],
  providers: [
    // Core services will be added here
  ],
  exports: [
    CoreConfigModule,
    CoreCacheModule,
    CoreDatabaseModule,
    // TODO: Export other core modules
  ],
})
export class CoreModule {}
