import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { ICacheService } from '../../features/security/services/cache.service';

/**
 * Redis Cache Service
 * Redis를 사용한 캐시 서비스 구현
 */
@Injectable()
export class RedisCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: any = null;
  private isConnected = false;

  constructor(private readonly configService: AppConfigService) {
    this.initializeRedis();
  }

  /**
   * Redis 클라이언트 초기화
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisConfig = this.configService.redisConfig;
      
      if (!redisConfig.host) {
        this.logger.warn('Redis not configured, falling back to memory cache');
        return;
      }

      // Redis 클라이언트 동적 import (optional dependency)
      let Redis: any;
      try {
        Redis = (await import('ioredis')).default;
      } catch (error) {
        this.logger.warn('Redis package not installed, using memory cache fallback');
        return;
      }

      this.client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Redis connected: ${redisConfig.host}:${redisConfig.port}`);
      });

      this.client.on('error', (error: Error) => {
        this.isConnected = false;
        this.logger.error(`Redis connection error: ${error.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      // 연결 테스트
      await this.client.connect();
      await this.client.ping();
      
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error instanceof Error ? error.message : String(error)}`);
      this.client = null;
    }
  }

  /**
   * 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      return JSON.parse(value);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 값 저장
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      this.logger.warn(`Redis not available, cannot set key: ${key}`);
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 값 삭제
   */
  async delete(key: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DELETE error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 키 존재 확인
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 모든 캐시 클리어
   */
  async clear(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.flushdb();
      this.logger.log('Redis cache cleared');
    } catch (error) {
      this.logger.error(`Redis CLEAR error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 여러 값 조회
   */
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || !this.isConnected) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map((value: string | null) => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error(`Redis MGET error: ${error instanceof Error ? error.message : String(error)}`);
      return keys.map(() => null);
    }
  }

  /**
   * 여러 값 저장
   */
  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const pipeline = this.client.pipeline();
      
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        if (entry.ttl) {
          pipeline.setex(entry.key, entry.ttl, serialized);
        } else {
          pipeline.set(entry.key, serialized);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Redis MSET error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 여러 키 삭제
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (!this.client || !this.isConnected || keys.length === 0) {
      return;
    }

    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Redis DELETE MANY error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * TTL 조회
   */
  async getTtl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return -1;
    }
  }

  /**
   * 패턴으로 키 검색
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Redis KEYS error for pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Redis 연결 상태 확인
   */
  isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Redis 정보 조회
   */
  async getRedisInfo(): Promise<Record<string, any> | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: this.isConnected,
        version: this.extractInfoValue(info, 'redis_version'),
        uptime: this.extractInfoValue(info, 'uptime_in_seconds'),
        connectedClients: this.extractInfoValue(info, 'connected_clients'),
        usedMemory: this.extractInfoValue(memory, 'used_memory_human'),
        totalKeys: this.extractKeyspaceKeys(keyspace),
      };
    } catch (error) {
      this.logger.error(`Redis INFO error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Redis info 파싱 헬퍼
   */
  private extractInfoValue(info: string, key: string): string | null {
    const match = info.match(new RegExp(`${key}:(.+)`));
    return match ? match[1].trim() : null;
  }

  /**
   * Keyspace에서 키 개수 추출
   */
  private extractKeyspaceKeys(keyspace: string): number {
    const match = keyspace.match(/keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 모듈 종료 시 정리
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis connection closed gracefully');
      } catch (error) {
        this.logger.error(`Error closing Redis connection: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
