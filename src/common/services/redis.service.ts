import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import * as IORedis from 'ioredis';

/**
 * Redis 연결 상태
 */
export enum RedisConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  READY = 'ready',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * Redis 관리 서비스 (간소화 버전)
 * 기본적인 Redis 연결 관리만 제공
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // node-redis v4 클라이언트
  private client: any;

  // 연결 상태
  private status: RedisConnectionStatus = RedisConnectionStatus.DISCONNECTED;

  // 설정
  private readonly config: any;
  private readonly isConfigured: boolean;

  // 통계
  private stats = {
    commandsSent: 0,
    commandsFailed: 0,
    reconnections: 0,
    lastError: null as Date | null,
    connectedAt: null as Date | null,
  };

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get('redis') || {};
    this.isConfigured = !!this.config.host;

    if (!this.isConfigured) {
      this.logger.warn('Redis not configured. Running in memory-only mode.');
    } else {
      this.logger.log(`Redis configured: ${this.config.host}:${this.config.port}/${this.config.db}`);
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.isConfigured) {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Redis 연결 초기화
   */
  private async connect(): Promise<void> {
    try {
      this.logger.log('Connecting to Redis...');
      this.status = RedisConnectionStatus.CONNECTING;

      // 간단한 Redis URL 생성
      const url = this.config.password
        ? `redis://:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.db || 0}`
        : `redis://${this.config.host}:${this.config.port}/${this.config.db || 0}`;

      this.client = createClient({
        url,
        socket: {
          connectTimeout: this.config.connectTimeout || 10000,
          keepAlive: this.config.keepAlive || 1000,
        },
        name: this.config.connectionName || 'anti-scraping-server',
      });

      this.setupEventHandlers();
      await this.client.connect();

    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.status = RedisConnectionStatus.ERROR;
      this.stats.lastError = new Date();
    }
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.status = RedisConnectionStatus.CONNECTED;
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ready');
      this.status = RedisConnectionStatus.READY;
      this.stats.connectedAt = new Date();
    });

    this.client.on('error', (error: any) => {
      this.logger.error('Redis error:', error);
      this.status = RedisConnectionStatus.ERROR;
      this.stats.lastError = new Date();
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting...');
      this.status = RedisConnectionStatus.RECONNECTING;
      this.stats.reconnections++;
    });

    this.client.on('end', () => {
      this.logger.log('Redis connection closed');
      this.status = RedisConnectionStatus.CLOSED;
    });
  }

  /**
   * Redis 연결 해제
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        this.logger.error('Error disconnecting Redis:', error);
      }
      this.client = null;
    }

    this.status = RedisConnectionStatus.CLOSED;
    this.logger.log('Redis disconnected');
  }

  /**
   * 클라이언트 가져오기
   */
  getClient(): any {
    return this.client;
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.status === RedisConnectionStatus.READY;
  }

  /**
   * 연결 상태 가져오기
   */
  getStatus(): RedisConnectionStatus {
    return this.status;
  }

  /**
   * 통계 가져오기
   */
  getStats(): any {
    return {
      ...this.stats,
      status: this.status,
      uptime: this.stats.connectedAt ? Date.now() - this.stats.connectedAt.getTime() : 0,
    };
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * 키-값 설정 (TTL 포함)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Redis not connected');
    }

    const prefixedKey = this.getPrefixedKey(key);
    const serialized = JSON.stringify(value);

    try {
      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, serialized);
      } else {
        await this.client.set(prefixedKey, serialized);
      }
      this.stats.commandsSent++;
    } catch (error) {
      this.stats.commandsFailed++;
      throw error;
    }
  }

  /**
   * 키-값 가져오기
   */
  async get(key: string): Promise<any> {
    if (!this.isConnected()) {
      return null;
    }

    const prefixedKey = this.getPrefixedKey(key);

    try {
      const value = await this.client.get(prefixedKey);
      this.stats.commandsSent++;
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.stats.commandsFailed++;
      throw error;
    }
  }

  /**
   * 키 삭제
   */
  async del(key: string | string[]): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    const keys = Array.isArray(key) ? key : [key];
    const prefixedKeys = keys.map((k) => this.getPrefixedKey(k));

    try {
      const result = await this.client.del(prefixedKeys);
      this.stats.commandsSent++;
      return result;
    } catch (error) {
      this.stats.commandsFailed++;
      throw error;
    }
  }

  /**
   * TTL 확인
   */
  async ttl(key: string): Promise<number> {
    if (!this.isConnected()) {
      return -1;
    }

    const prefixedKey = this.getPrefixedKey(key);

    try {
      const result = await this.client.ttl(prefixedKey);
      this.stats.commandsSent++;
      return result;
    } catch (error) {
      this.stats.commandsFailed++;
      throw error;
    }
  }

  /**
   * 키에 프리픽스 추가
   */
  private getPrefixedKey(key: string): string {
    const prefix = this.config.keyPrefix || 'anti-scraping:';
    return `${prefix}${key}`;
  }
}
