import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Redis 설정
 * Redis 연결 및 관련 설정을 관리합니다.
 */
export default registerAs('redis', () => {
  const config = {
    // 기본 연결 설정
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB, 10) || 0,
      family: parseInt(process.env.REDIS_FAMILY, 10) || 4, // 4 (IPv4) or 6 (IPv6)

      // 연결 관련 설정
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
      keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 30000,
      noDelay: process.env.REDIS_NO_DELAY === 'true',
      connectionName: process.env.REDIS_CONNECTION_NAME || 'anti-scraping-server',
    },

    // 재시도 전략
    retry: {
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY, 10) || 1000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    },

    // 연결 풀 설정 (Bull Queue 등에서 사용)
    pool: {
      min: parseInt(process.env.REDIS_POOL_MIN, 10) || 2,
      max: parseInt(process.env.REDIS_POOL_MAX, 10) || 10,
    },

    // Sentinel 설정 (고가용성)
    sentinel: {
      enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
      sentinels: process.env.REDIS_SENTINELS
        ? process.env.REDIS_SENTINELS.split(',').map((s) => {
            const [host, port] = s.trim().split(':');
            return { host, port: parseInt(port, 10) || 26379 };
          })
        : [],
      name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
      password: process.env.REDIS_SENTINEL_PASSWORD,
    },

    // Cluster 설정
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES
        ? process.env.REDIS_CLUSTER_NODES.split(',').map((node) => {
            const [host, port] = node.trim().split(':');
            return { host, port: parseInt(port, 10) || 6379 };
          })
        : [],
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
      },
    },

    // TLS/SSL 설정
    tls: {
      enabled: process.env.REDIS_TLS_ENABLED === 'true',
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.REDIS_TLS_CA,
      cert: process.env.REDIS_TLS_CERT,
      key: process.env.REDIS_TLS_KEY,
    },

    // 캐시 설정
    cache: {
      ttl: parseInt(process.env.REDIS_DEFAULT_TTL, 10) || 3600, // 1 hour
      max: parseInt(process.env.REDIS_MAX_ITEMS, 10) || 10000,

      // 키 프리픽스
      keyPrefix: {
        global: process.env.REDIS_KEY_PREFIX || 'anti-scraping:',
        blacklist: 'blacklist:',
        rateLimit: 'rate-limit:',
        session: 'session:',
        cache: 'cache:',
      },
    },

    // 모니터링 및 로깅
    monitoring: {
      enabled: process.env.REDIS_MONITORING_ENABLED === 'true',
      logSlowCommands: process.env.REDIS_LOG_SLOW_COMMANDS === 'true',
      slowLogThreshold: parseInt(process.env.REDIS_SLOW_LOG_THRESHOLD, 10) || 100, // ms
    },

    // 성능 최적화
    optimization: {
      enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== 'false',
      enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== 'false',
      lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',

      // 파이프라이닝
      enableAutoPipelining: process.env.REDIS_AUTO_PIPELINING === 'true',
      autoPipeliningIgnoredCommands: ['info', 'ping', 'quit', 'monitor'],
    },
  };

  // Redis가 설정되어 있는지 확인
  config['isConfigured'] = !!(config.connection.host && config.connection.host !== '');

  return config;
});

/**
 * IoRedis 옵션 생성 헬퍼
 */
export function createRedisOptions(config: any): RedisOptions {
  const options: RedisOptions = {
    host: config.connection.host,
    port: config.connection.port,
    password: config.connection.password,
    db: config.connection.db,
    family: config.connection.family,
    connectTimeout: config.connection.connectTimeout,
    keepAlive: config.connection.keepAlive,
    noDelay: config.connection.noDelay,
    connectionName: config.connection.connectionName,

    // 재시도 전략
    retryStrategy: config.retry.retryStrategy,
    maxRetriesPerRequest: config.retry.maxRetries,

    // 성능 최적화
    enableOfflineQueue: config.optimization.enableOfflineQueue,
    enableReadyCheck: config.optimization.enableReadyCheck,
    lazyConnect: config.optimization.lazyConnect,
  };

  // TLS 설정
  if (config.tls.enabled) {
    options.tls = {
      rejectUnauthorized: config.tls.rejectUnauthorized,
      ca: config.tls.ca,
      cert: config.tls.cert,
      key: config.tls.key,
    };
  }

  // 자동 파이프라이닝
  if (config.optimization.enableAutoPipelining) {
    options.enableAutoPipelining = true;
    options.autoPipeliningIgnoredCommands = config.optimization.autoPipeliningIgnoredCommands;
  }

  return options;
}

/**
 * Redis 연결 상태
 */
export enum RedisConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  READY = 'ready',
  ERROR = 'error',
  CLOSED = 'closed',
  RECONNECTING = 'reconnecting',
}
