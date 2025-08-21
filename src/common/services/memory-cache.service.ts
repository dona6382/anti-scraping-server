import { Injectable, Logger } from '@nestjs/common';
import { BaseCacheService } from './base-cache.service';

/**
 * Memory Cache Entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Memory Cache Service
 * 메모리 기반 캐시 구현 (Redis가 없을 때 사용)
 */
@Injectable()
export class MemoryCacheService extends BaseCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly maxSize: number;

  constructor(keyPrefix: string = '', maxSize: number = 10000) {
    super(keyPrefix);
    this.maxSize = maxSize;
    
    // 주기적으로 만료된 항목 정리
    setInterval(() => this.cleanupExpired(), 60000); // 1분마다
    
    this.logger.log(`Initialized with max size: ${maxSize}, prefix: ${keyPrefix}`);
  }

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry) {
      return null;
    }
    
    // 만료 확인
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(prefixedKey);
      return null;
    }
    
    return entry.value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    
    // 크기 제한 확인
    if (this.cache.size >= this.maxSize && !this.cache.has(prefixedKey)) {
      // LRU 방식으로 가장 오래된 항목 제거
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    const entry: CacheEntry<T> = {
      value,
      ...(expiresAt && { expiresAt }),
    };
    
    this.cache.set(prefixedKey, entry);
  }

  async delete(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    this.cache.delete(prefixedKey);
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.key, entry.value, entry.ttl))
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async getTtl(key: string): Promise<number> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry || !entry.expiresAt) {
      return -1;
    }
    
    const ttl = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : -1;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    const keys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        // Remove prefix before returning
        const unprefixedKey = this.keyPrefix 
          ? key.substring(this.keyPrefix.length + 1) 
          : key;
        keys.push(unprefixedKey);
      }
    }
    
    return keys;
  }

  /**
   * 만료된 항목 정리
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * 패턴을 정규식으로 변환
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}
