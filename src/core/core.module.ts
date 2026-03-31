import { Module, Global } from '@nestjs/common';

import { CoreCacheModule } from './cache/cache.module';
import { CoreConfigModule } from './config/config.module';
import { CoreDatabaseModule } from './database/database.module';

/**
 * Global Core Module
 *
 * 인프라 계층:
 * - Config: 환경변수 관리
 * - Database: PostgreSQL (TypeORM)
 * - Cache: Redis / In-Memory fallback
 */
@Global()
@Module({
  imports: [CoreConfigModule, CoreCacheModule, CoreDatabaseModule],
  exports: [CoreConfigModule, CoreCacheModule, CoreDatabaseModule],
})
export class CoreModule {}
