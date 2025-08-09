import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICacheService } from './base-cache.service';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from './memory-cache.service';

/**
 * Cache Factory
 * 환경에 따라 적절한 캐시 구현체를 생성
 */
@Injectable()
export class CacheFactory {
  private readonly logger = new Logger(CacheFactory.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 캐시 서비스 생성
   */
  async create(keyPrefix: string = 'anti-scraping'): Promise<ICacheService> {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    
    if (redisHost) {
      try {
        this.logger.log('Attempting to use Redis cache...');
        const redisCache = new RedisCacheService(this.configService, keyPrefix);
        await redisCache.onModuleInit();
        
        // 연결 확인
        const isHealthy = await redisCache.healthCheck();
        if (isHealthy) {
          this.logger.log('Using Redis cache');
          return redisCache;
        } else {
          throw new Error('Redis health check failed');
        }
      } catch (error) {
        this.logger.warn(`Failed to initialize Redis cache: ${error.message}`);
        this.logger.log('Falling back to memory cache');
      }
    } else {
      this.logger.log('Redis not configured, using memory cache');
    }
    
    // Memory Cache로 폴백
    const maxSize = this.configService.get<number>('CACHE_MAX_SIZE', 10000);
    return new MemoryCacheService(keyPrefix, maxSize);
  }
}

/**
 * Cache Service Provider
 * 의존성 주입을 위한 프로바이더
 */
export const CacheServiceProvider = {
  provide: 'ICacheService',
  useFactory: async (cacheFactory: CacheFactory) => {
    return await cacheFactory.create();
  },
  inject: [CacheFactory],
};
