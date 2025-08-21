/**
 * Configuration Type Definitions
 */

/**
 * Redis Configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  family?: 4 | 6;
  connectionName?: string;
  connectTimeout?: number;
  keepAlive?: number;
  noDelay?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  poolMin?: number;
  poolMax?: number;
  defaultTtl?: number;
  maxItems?: number;
  keyPrefix?: string;
  enableOfflineQueue?: boolean;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  autoPipelining?: boolean;
}

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  maxConnections?: number;
  minConnections?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
  sslEnabled?: boolean;
  sslRejectUnauthorized?: boolean;
  queryTimeout?: number;
  statementTimeout?: number;
  logging?: boolean;
  logQueries?: boolean;
}

/**
 * Security Configuration
 */
export interface SecurityConfig {
  strictMode: boolean;
  ipBlacklist: {
    ttl: number;
    maxMemory: number;
  };
  userAgent: {
    blockedAgents: string[];
    strictMode: boolean;
  };
  honeypot: {
    fieldName: string;
    timeThreshold: number;
  };
  recaptcha: {
    secretKey?: string;
    scoreThreshold: number;
    failOpen: boolean;
    allowedHostnames?: string[];
  };
  rateLimit: {
    ttl: number;
    limit: number;
  };
}

/**
 * Server Configuration
 */
export interface ServerConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  corsEnabled: boolean;
  allowedOrigins: string[];
  swaggerEnabled: boolean;
  staticFilesEnabled: boolean;
  logLevel: 'error' | 'warn' | 'log' | 'debug' | 'verbose';
  logPretty: boolean;
}

/**
 * Complete Application Configuration
 */
export interface AppConfig {
  server: ServerConfig;
  security: SecurityConfig;
  redis?: RedisConfig;
  database?: DatabaseConfig;
}
