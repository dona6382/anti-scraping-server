/**
 * Common Types for Anti-Scraping Server
 * Enhanced with proper type safety
 */

import { Request } from 'express';
import { RedisClientType } from 'redis';
import { Redis as IORedisType } from 'ioredis';

// Re-export new type definitions
export * from './security.types';
export * from './config.types';

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
  } | any;
  socket?: {
    remoteAddress?: string;
  } | any;
  // New fields from security.types
  clientInfo?: import('./security.types').ClientInfo;
  securityContext?: import('./security.types').SecurityContext;
  requestId?: string;
  timestamp?: number;
  recaptchaToken?: string;
  honeypotData?: Record<string, unknown>;
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

// Browser detection types
export interface BrowserProperties {
  webdriver?: boolean;
  languages?: string[];
  plugins?: string[];
  userAgent?: string;
  platform?: string;
  cookieEnabled?: boolean;
  javaEnabled?: boolean;
  onLine?: boolean;
}

// Metrics types
export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  blockReasons: Record<SecurityReason, number>;
  responseTimeP50: number;
  responseTimeP95: number;
  responseTimeP99: number;
  timestamp: string;
}

export interface IpStatistics {
  totalBlocked: number;
  recentBlocks: number;
  topReasons: Record<string, number>;
  redisConnected?: boolean;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event types
export interface SecurityEvent {
  type: 'BLOCKED' | 'ALLOWED' | 'SUSPICIOUS';
  ip: string;
  userAgent: string;
  endpoint: string;
  reason?: SecurityReason;
  timestamp: Date;
  metadata?: Record<string, unknown>;
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

// Guard types (enhanced from security.types)
export interface GuardContext {
  request: ExtendedRequest;
  ip: string;
  userAgent: string;
  endpoint: string;
}

// Error types
export interface SecurityError extends Error {
  code: string;
  statusCode: number;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
}

// HTTP Client types
export interface HttpClientConfig {
  timeout: number;
  headers: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  url: string;
}

// reCAPTCHA types
export interface RecaptchaVerificationResponse {
  success: boolean;
  score: number;
  action: string;
  hostname: string;
  'error-codes'?: string[];
  challenge_ts?: string;
}

// Fingerprint types
export interface DeviceFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  connection: string;
  dnt?: string;
  upgradeInsecureRequests?: string;
  secFetchSite?: string;
  secFetchMode?: string;
  secFetchUser?: string;
  secFetchDest?: string;
  hash: string;
}

export interface WebGLData {
  vendor?: string;
  renderer?: string;
  version?: string;
  extensions?: string[];
  parameters?: Record<string, number | string | boolean>;
}

export interface ScreenData {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
}

export interface WebRTCData {
  localIP?: string;
  publicIP?: string;
  leaked?: boolean;
}

export interface BrowserData {
  canvas?: string;
  webgl?: WebGLData;
  audio?: string;
  fonts?: string[];
  screen?: ScreenData;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  colorDepth?: number;
  pixelRatio?: number;
  touchSupport?: boolean;
  webrtc?: WebRTCData | string;
  plugins?: Array<{ name: string; version?: string }>;
}

export interface BrowserFingerprint {
  id: string;
  canvas: string;
  webgl: WebGLData;
  audio: string;
  fonts: string[];
  screen: ScreenData;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  colorDepth?: number;
  pixelRatio?: number;
  touchSupport?: boolean;
  webrtc?: WebRTCData | string;
  plugins: string[];
  timestamp: Date;
  trustScore: number;
}

export interface FingerprintData {
  fingerprint: BrowserFingerprint;
  createdAt: number;
}

export interface Challenge {
  type: string;
  difficulty: number;
  data: Record<string, unknown>;
}

export interface FingerprintValidationResponse {
  success: boolean;
  fingerprintId: string;
  trustScore: number;
  botDetection: {
    isBot: boolean;
    score: number;
    confidence: number;
    factors: string[];
  };
  recommendation: string;
  challenge?: Challenge | null;
}
