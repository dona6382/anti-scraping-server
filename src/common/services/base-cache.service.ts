import { Injectable } from '@nestjs/common';

/**
 * Cache Service Interface
 * 캐시 구현체를 위한 인터페이스
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  getTtl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

/**
 * Base Cache Service
 * 모든 캐시 구현체의 기본 클래스
 */
@Injectable()
export abstract class BaseCacheService implements ICacheService {
  protected readonly keyPrefix: string;

  constructor(keyPrefix: string = '') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * 키에 프리픽스 추가
   */
  protected prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * 여러 키에 프리픽스 추가
   */
  protected prefixKeys(keys: string[]): string[] {
    return keys.map((key) => this.prefixKey(key));
  }

  /**
   * 값 직렬화
   */
  protected serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * 값 역직렬화
   */
  protected deserialize<T>(value: string): T | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  // 추상 메서드들
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract getMany<T>(keys: string[]): Promise<(T | null)[]>;
  abstract setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  abstract deleteMany(keys: string[]): Promise<void>;
  abstract getTtl(key: string): Promise<number>;
  abstract keys(pattern: string): Promise<string[]>;
}
