import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import * as IORedis from 'ioredis';
import { createRedisOptions, RedisConnectionStatus } from '../config/redis.config';

/**
 * Redis 관리 서비스
 * 모든 Redis 연결을 중앙에서 관리합니다.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // node-redis v4 클라이언트
  private client: any;

  // ioredis 클라이언트 (고급 기능용)
  private ioredisClient: IORedis.Redis;

  // 연결 상태
  private status: RedisConnectionStatus = RedisConnectionStatus.CLOSED;

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
    this.config = this.configService.get('redis');
    this.isConfigured = this.config?.isConfigured || false;

    if (!this.isConfigured) {
      this.logger.warn('Redis not configured. Running in memory-only mode.');
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
      // Cluster 모드
      if (this.config.cluster.enabled) {
        await this.connectCluster();
        return;
      }

      // Sentinel 모드
      if (this.config.sentinel.enabled) {
        await this.connectSentinel();
        return;
      }

      // 단일 인스턴스 모드
      await this.connectSingle();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.status = RedisConnectionStatus.ERROR;
      this.stats.lastError = new Date();
    }
  }

  /**
   * 단일 Redis 인스턴스 연결
   */
  private async connectSingle(): Promise<void> {
    this.logger.log('Connecting to Redis (single instance mode)...');
    this.status = RedisConnectionStatus.CONNECTING;

    // node-redis v4 클라이언트 생성
    const url = this.config.connection.password
      ? `redis://:${this.config.connection.password}@${this.config.connection.host}:${this.config.connection.port}/${this.config.connection.db}`
      : `redis://${this.config.connection.host}:${this.config.connection.port}/${this.config.connection.db}`;

    this.client = createClient({
      url,
      socket: {
        connectTimeout: this.config.connection.connectTimeout,
        keepAlive: this.config.connection.keepAlive,
        noDelay: this.config.connection.noDelay,
      },
      name: this.config.connection.connectionName,
    });

    // 이벤트 핸들러 등록
    this.setupEventHandlers();

    // 연결
    await this.client.connect();

    // ioredis 클라이언트도 생성 (고급 기능용)
    if (this.config.optimization.enableAutoPipelining) {
      const options = createRedisOptions(this.config);
      this.ioredisClient = new IORedis.default(options);

      this.ioredisClient.on('ready', () => {
        this.logger.log('IORedis client ready with auto-pipelining');
      });
    }
  }

  /**
   * Redis Sentinel 연결
   */
  private async connectSentinel(): Promise<void> {
    this.logger.log('Connecting to Redis (sentinel mode)...');
    this.status = RedisConnectionStatus.CONNECTING;

    this.ioredisClient = new IORedis.default({
      sentinels: this.config.sentinel.sentinels,
      name: this.config.sentinel.name,
      password: this.config.connection.password,
      db: this.config.connection.db,
      sentinelPassword: this.config.sentinel.password,
      ...createRedisOptions(this.config),
    });

    this.setupIoredisEventHandlers();
  }

  /**
   * Redis Cluster 연결
   */
  private async connectCluster(): Promise<void> {
    this.logger.log('Connecting to Redis (cluster mode)...');
    this.status = RedisConnectionStatus.CONNECTING;

    const cluster = new IORedis.Cluster(this.config.cluster.nodes, {
      redisOptions: {
        password: this.config.connection.password,
        ...createRedisOptions(this.config),
      },
    });

    this.ioredisClient = cluster as any;
    this.setupIoredisEventHandlers();
  }

  /**
   * node-redis 이벤트 핸들러 설정
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

    this.client.on('error', (error) => {
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
   * ioredis 이벤트 핸들러 설정
   */
  private setupIoredisEventHandlers(): void {
    if (!this.ioredisClient) return;

    this.ioredisClient.on('connect', () => {
      this.logger.log('IORedis connected');
      this.status = RedisConnectionStatus.CONNECTED;
    });

    this.ioredisClient.on('ready', () => {
      this.logger.log('IORedis ready');
      this.status = RedisConnectionStatus.READY;
      this.stats.connectedAt = new Date();
    });

    this.ioredisClient.on('error', (error) => {
      this.logger.error('IORedis error:', error);
      this.status = RedisConnectionStatus.ERROR;
      this.stats.lastError = new Date();
    });

    this.ioredisClient.on('close', () => {
      this.logger.log('IORedis connection closed');
      this.status = RedisConnectionStatus.CLOSED;
    });

    this.ioredisClient.on('reconnecting', () => {
      this.logger.warn('IORedis reconnecting...');
      this.status = RedisConnectionStatus.RECONNECTING;
      this.stats.reconnections++;
    });
  }

  /**
   * Redis 연결 해제
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    if (this.ioredisClient) {
      this.ioredisClient.disconnect();
      this.ioredisClient = null;
    }

    this.status = RedisConnectionStatus.CLOSED;
    this.logger.log('Redis disconnected');
  }

  /**
   * 기본 클라이언트 가져오기
   */
  getClient(): any {
    return this.client;
  }

  /**
   * IORedis 클라이언트 가져오기
   */
  getIoredisClient(): IORedis.Redis | null {
    return this.ioredisClient;
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
      if (this.client) {
        await this.client.ping();
      } else if (this.ioredisClient) {
        await this.ioredisClient.ping();
      }
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  // ============================================
  // 래퍼 메서드들 (편의 기능)
  // ============================================

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
        if (this.client) {
          await this.client.setEx(prefixedKey, ttl, serialized);
        } else if (this.ioredisClient) {
          await this.ioredisClient.setex(prefixedKey, ttl, serialized);
        }
      } else {
        if (this.client) {
          await this.client.set(prefixedKey, serialized);
        } else if (this.ioredisClient) {
          await this.ioredisClient.set(prefixedKey, serialized);
        }
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
      let value: string | null = null;

      if (this.client) {
        value = await this.client.get(prefixedKey);
      } else if (this.ioredisClient) {
        value = await this.ioredisClient.get(prefixedKey);
      }

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
      let result = 0;

      if (this.client) {
        result = await this.client.del(prefixedKeys);
      } else if (this.ioredisClient) {
        result = await this.ioredisClient.del(...prefixedKeys);
      }

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
      let result = -1;

      if (this.client) {
        result = await this.client.ttl(prefixedKey);
      } else if (this.ioredisClient) {
        result = await this.ioredisClient.ttl(prefixedKey);
      }

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
    const prefix = this.config?.cache?.keyPrefix?.global || 'anti-scraping:';
    return `${prefix}${key}`;
  }
}
