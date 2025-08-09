import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { BaseCacheService } from './base-cache.service';

/**
 * Redis Cache Service
 * Redis 기반 캐시 구현
 */
@Injectable()
export class RedisCacheService extends BaseCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    keyPrefix: string = 'anti-scraping',
  ) {
    super(keyPrefix);
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Redis 연결
   */
  private async connect(): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db = this.configService.get<number>('REDIS_DB', 0);

      const url = password 
        ? `redis://:${password}@${host}:${port}/${db}`
        : `redis://${host}:${port}/${db}`;

      this.client = createClient({
        url,
        socket: {
          connectTimeout: 5000,
          keepAlive: 5000,
        },
      });

      // 이벤트 핸들러 등록
      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        this.logger.log('Redis Client Ready');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Redis 연결 해제
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.logger.log('Disconnected from Redis');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    
    try {
      const prefixedKey = this.prefixKey(key);
      const value = await this.client.get(prefixedKey);
      return value ? this.deserialize<T>(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const prefixedKey = this.prefixKey(key);
      const serialized = this.serialize(value);
      
      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, serialized);
      } else {
        await this.client.set(prefixedKey, serialized);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const prefixedKey = this.prefixKey(key);
      await this.client.del(prefixedKey);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const prefixedKey = this.prefixKey(key);
      const result = await this.client.exists(prefixedKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check key existence ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const pattern = this.prefixKey('*');
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.log(`Cleared ${keys.length} keys`);
      }
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected) return keys.map(() => null);
    
    try {
      const prefixedKeys = this.prefixKeys(keys);
      const values = await this.client.mGet(prefixedKeys);
      
      return values.map((value) => 
        value ? this.deserialize<T>(value) : null
      );
    } catch (error) {
      this.logger.error('Failed to get multiple keys:', error);
      return keys.map(() => null);
    }
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const pipeline = this.client.multi();
      
      for (const entry of entries) {
        const prefixedKey = this.prefixKey(entry.key);
        const serialized = this.serialize(entry.value);
        
        if (entry.ttl) {
          pipeline.setEx(prefixedKey, entry.ttl, serialized);
        } else {
          pipeline.set(prefixedKey, serialized);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to set multiple keys:', error);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const prefixedKeys = this.prefixKeys(keys);
      await this.client.del(prefixedKeys);
    } catch (error) {
      this.logger.error('Failed to delete multiple keys:', error);
    }
  }

  async getTtl(key: string): Promise<number> {
    if (!this.isConnected) return -1;
    
    try {
      const prefixedKey = this.prefixKey(key);
      return await this.client.ttl(prefixedKey);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    
    try {
      const prefixedPattern = this.prefixKey(pattern);
      const keys = await this.client.keys(prefixedPattern);
      
      // Remove prefix before returning
      return keys.map((key) => 
        this.keyPrefix ? key.substring(this.keyPrefix.length + 1) : key
      );
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * 연결 상태 확인
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}
