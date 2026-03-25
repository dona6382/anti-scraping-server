import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheService } from './interfaces/cache.interface';

/**
 * Memory Cache Service
 * In-Memory 캐시 (Redis 미설정 시 fallback)
 */
@Injectable()
export class MemoryCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly cache = new Map<string, { value: unknown; expiresAt?: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;

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
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
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
    
    // 패턴 매칭 (*, ? 지원) — 메타문자 이스케이프 후 glob 변환
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    
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
