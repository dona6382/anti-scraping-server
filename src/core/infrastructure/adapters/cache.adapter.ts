import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';
import * as IORedis from 'ioredis';
import { ICache } from '../../domain/interfaces/security.interfaces';

/**
 * Redis Cache Adapter
 * Redis를 사용한 캐시 구현
 */
@Injectable()
export class RedisCacheAdapter implements ICache, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private client: any;
  private ioredisClient: IORedis.Redis;
  private connected = false;

  constructor(
    private readonly config: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
      ttl?: number;
    } = {}
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    if (!this.config.host) {
      this.logger.warn('Redis not configured, cache disabled');
      return;
    }

    try {
      // Use IORedis for better features
      this.ioredisClient = new IORedis.default({
        host: this.config.host,
        port: this.config.port || 6379,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || 'cache:',
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.ioredisClient.on('connect', () => {
        this.connected = true;
        this.logger.log('Redis cache connected');
      });

      this.ioredisClient.on('error', (error) => {
        this.logger.error('Redis cache error:', error);
      });

      this.ioredisClient.on('close', () => {
        this.connected = false;
        this.logger.warn('Redis cache disconnected');
      });

      // Wait for connection
      await this.ioredisClient.ping();
      this.connected = true;
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.ioredisClient) {
      this.ioredisClient.disconnect();
      this.ioredisClient = null;
    }
    this.connected = false;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const value = await this.ioredisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.config.ttl || 3600;

      await this.ioredisClient.setex(key, expiry, serialized);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.ioredisClient.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.ioredisClient.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.ioredisClient.flushdb();
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get multiple values
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.connected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.ioredisClient.mget(...keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      this.logger.error('Failed to mget:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values
   */
  async mset<T = any>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.connected || items.length === 0) return;

    try {
      const pipeline = this.ioredisClient.pipeline();
      
      for (const item of items) {
        const serialized = JSON.stringify(item.value);
        const ttl = item.ttl || this.config.ttl || 3600;
        pipeline.setex(item.key, ttl, serialized);
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to mset:', error);
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    if (!this.connected) return 0;

    try {
      return await this.ioredisClient.incrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to increment ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decr(key: string, amount: number = 1): Promise<number> {
    if (!this.connected) return 0;

    try {
      return await this.ioredisClient.decrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to decrement ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    if (!this.connected) return -1;

    try {
      return await this.ioredisClient.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for ${key}:`, error);
      return -1;
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.ioredisClient.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set expiration for ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.connected) return false;

    try {
      await this.ioredisClient.ping();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Memory Cache Adapter
 * In-memory cache implementation (fallback)
 */
@Injectable()
export class MemoryCacheAdapter implements ICache {
  private readonly cache = new Map<string, { value: any; expiresAt?: Date }>();
  private readonly logger = new Logger(MemoryCacheAdapter.name);
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly config: {
      maxSize?: number;
      ttl?: number;
      cleanupIntervalMs?: number;
    } = {}
  ) {
    this.startCleanup();
  }

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (item.expiresAt && item.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl 
      ? new Date(Date.now() + ttl * 1000)
      : this.config.ttl
        ? new Date(Date.now() + this.config.ttl * 1000)
        : undefined;

    this.cache.set(key, { value, expiresAt });

    // Enforce size limit
    if (this.config.maxSize && this.cache.size > this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private startCleanup(): void {
    const interval = this.config.cleanupIntervalMs || 60000;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  private cleanup(): void {
    const now = new Date();
    const toDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}
