/**
 * Common Types for Anti-Scraping Server
 */

// Request types
export interface ExtendedRequest {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  method: string;
  url: string;
  query: Record<string, string | string[] | undefined>;
  connection?: any;
  socket?: any;
}

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
  expiresAt?: Date | undefined;
  count: number;
}

// Cache types
export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number | undefined;
}

export interface CacheStatistics {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
}

// Configuration types
export interface SecurityConfig {
  strictMode: boolean;
  honeypotField: string;
  honeypotTimeThreshold: number;
  recaptchaScoreThreshold: number;
  recaptchaFailOpen: boolean;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  security: SecurityConfig;
  throttle: ThrottleConfig;
  blockedUserAgents: string[];
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  isConfigured: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
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

// Guard types
export interface GuardContext {
  request: ExtendedRequest;
  ip: string;
  userAgent: string;
  endpoint: string;
}

export interface GuardResult {
  allowed: boolean;
  reason?: SecurityReason;
  metadata?: Record<string, unknown>;
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
