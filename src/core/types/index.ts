/**
 * Common Types for Anti-Scraping Server
 * Enhanced with proper type safety
 */

import { Request } from 'express';
import { RedisClientType } from 'redis';
import { Redis as IORedisType } from 'ioredis';

// Enhanced Request type (replacing the old one)
export interface ExtendedRequest extends Omit<Request, 'connection' | 'socket'> {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  method: string;
  url: string;
  query: Record<string, string | string[] | undefined>;
  connection?: {
    remoteAddress?: string;
  };
  socket?: {
    remoteAddress?: string;
  };
  // New fields
  clientInfo?: ClientInfo;
  securityContext?: SecurityContext;
  requestId?: string;
  timestamp?: number;
  recaptchaToken?: string;
  honeypotData?: Record<string, unknown>;
}

// Client Information
export interface ClientInfo {
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  referer?: string;
  origin?: string;
  timestamp: Date;
  fingerprint?: string;
}

// Security Context
export interface SecurityContext {
  guardsExecuted: string[];
  guardsBlocked: string[];
  violations: SecurityViolation[];
  metadata: Record<string, unknown>;
}

// Redis Client Types (replacing any)
export type RedisClient = RedisClientType | IORedisType | null;

// Security types
export type SecurityReason = 
  | 'MANUAL_ADMIN_ACTION'
  | 'BOT_DETECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_BEHAVIOR'
  | 'HONEYPOT_TRIGGERED'
  | 'INVALID_USER_AGENT'
  | 'HEADLESS_BROWSER_DETECTED'
  | 'RECAPTCHA_VERIFICATION_FAILED';

export interface SecurityViolation {
  type: SecurityReason;
  ip: string;
  userAgent: string;
  timestamp: Date;
  endpoint: string;
  details?: Record<string, unknown>;
}

export interface BlacklistEntry {
  ip: string;
  reason: SecurityReason;
  blockedAt: Date;
  expiresAt?: Date;
  count: number;
}

// Cache types
export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number;
}

export interface CacheStatistics {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
}

// Configuration types (keeping for backward compatibility)
export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T | undefined;
  message?: string | undefined;
  timestamp: string;
  code?: string | undefined;
  details?: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, {
    status: 'up' | 'down';
    responseTime?: number;
    error?: string;
    details?: Record<string, unknown>;
  }>;
  timestamp: string;
  uptime: number;
}

// Service interfaces
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

export interface ISecurityService {
  isBlocked(ip: string): Promise<boolean>;
  blockIp(ip: string, reason: SecurityReason, ttl?: number): Promise<void>;
  unblockIp(ip: string): Promise<void>;
  getBlockInfo(ip: string): Promise<BlacklistEntry | null>;
  getStatistics(): Promise<IpStatistics>;
}

export interface IpStatistics {
  totalBlocked: number;
  recentBlocks: number;
  topReasons: Record<string, number>;
  redisConnected?: boolean;
}
