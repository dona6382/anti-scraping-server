import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheService } from './interfaces/cache.interface';

/**
 * Memory Cache Service
 * In-Memory 캐시 (Redis 미설정 시 fallback)
 */
/** 최대 캐시 엔트리 수 — 초과 시 만료된 항목 정리 후 가장 오래된 항목 삭제 */
const MAX_CACHE_SIZE = 50_000;

@Injectable()
export class MemoryCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly cache = new Map<string, { value: unknown; expiresAt?: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;
  private isEvicting = false;

  constructor() {
    // 5분마다 만료된 항목 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    this.logger.log('Memory cache service initialized');
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 만료 확인
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + (ttl * 1000) : undefined;

    this.cache.set(key, {
      value,
      expiresAt,
    });

    // 크기 제한 — 초과 시 만료 항목 정리 후 가장 오래된 항목 삭제
    if (this.cache.size > MAX_CACHE_SIZE && !this.isEvicting) {
      this.isEvicting = true;
      try {
        this.cleanupExpiredEntries();
        if (this.cache.size > MAX_CACHE_SIZE) {
          const overflow = this.cache.size - MAX_CACHE_SIZE;
          const keys = this.cache.keys();
          for (let i = 0; i < overflow; i++) {
            const oldest = keys.next().value;
            if (oldest) this.cache.delete(oldest);
          }
          this.logger.warn(`Cache evicted ${overflow} entries (size limit: ${MAX_CACHE_SIZE})`);
        }
      } finally {
        this.isEvicting = false;
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async getAndDelete<T>(key: string): Promise<T | null> {
    const result = await this.get<T>(key);
    if (result !== null) {
      this.cache.delete(key);
    }
    return result;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // 만료 확인
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    
    return results;
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  async getTtl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    
    if (!entry || !entry.expiresAt) {
      return -1;
    }

    const ttl = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    return ttl;
  }

  async keys(pattern: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    // 최적화: prefix* 패턴은 정규식 없이 startsWith로 처리 (ReDoS 방지)
    if (pattern.endsWith('*') && !pattern.includes('?') && pattern.indexOf('*') === pattern.length - 1) {
      const prefix = pattern.slice(0, -1);
      return allKeys.filter(key => key.startsWith(prefix));
    }

    // 일반 glob 패턴 — 메타문자 이스케이프 후 변환
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\*/g, '[^:]*').replace(/\?/g, '.') + '$';
    const regex = new RegExp(regexStr);

    return allKeys.filter(key => regex.test(key));
  }

  /**
   * 만료된 항목 정리
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * 종료 시 정리
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
