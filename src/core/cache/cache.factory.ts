import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from '../../features/security/services/memory-cache.service';
import { ICacheService } from '../../features/security/services/cache.service';

/**
 * Cache Factory
 * Redis 또는 Memory Cache를 환경에 따라 자동 선택
 */
@Injectable()
export class CacheFactory {
  private readonly logger = new Logger(CacheFactory.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly redisCacheService: RedisCacheService,
    private readonly memoryCacheService: MemoryCacheService,
  ) {}

  /**
   * 적절한 캐시 서비스 반환
   */
  createCacheService(): ICacheService {
    const redisConfig = this.configService.redisConfig;
    
    // Redis 설정이 있으면 Redis 사용
    if (redisConfig.host) {
      this.logger.log('Using Redis cache service');
      return this.redisCacheService;
    }
    
    // 없으면 Memory cache 사용
    this.logger.log('Using Memory cache service (Redis not configured)');
    return this.memoryCacheService;
  }

  /**
   * Redis 연결 상태 확인
   */
  async checkRedisConnection(): Promise<boolean> {
    if (this.redisCacheService.isRedisConnected()) {
      return true;
    }
    return false;
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStats(): Promise<{
    type: 'redis' | 'memory';
    connected: boolean;
    info?: Record<string, any>;
  }> {
    const redisConfig = this.configService.redisConfig;
    
    if (redisConfig.host && this.redisCacheService.isRedisConnected()) {
      const info = await this.redisCacheService.getRedisInfo();
      return {
        type: 'redis',
        connected: true,
        info,
      };
    }
    
    return {
      type: 'memory',
      connected: true,
      info: {
        // Memory cache stats would go here
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    };
  }
}
