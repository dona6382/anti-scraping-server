import { Module, Global } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { CacheFactory } from './cache.factory';
import { MemoryCacheService } from '../../features/security/services/memory-cache.service';

/**
 * Core Cache Module
 * 
 * Redis 또는 Memory 캐시를 환경에 따라 자동 선택하는 모듈
 */
@Global()
@Module({
  providers: [
    RedisCacheService,
    MemoryCacheService,
    CacheFactory,
    {
      provide: 'ICacheService',
      useFactory: (cacheFactory: CacheFactory) => {
        return cacheFactory.createCacheService();
      },
      inject: [CacheFactory],
    },
  ],
  exports: [
    'ICacheService',
    CacheFactory,
    RedisCacheService,
  ],
})
export class CoreCacheModule {}
