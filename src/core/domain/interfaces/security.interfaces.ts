/**
 * Core Security Interfaces
 * 보안 관련 핵심 인터페이스 정의
 */

/**
 * IP 검증 결과
 */
export interface IpValidationResult {
  readonly isValid: boolean;
  readonly isBlacklisted: boolean;
  readonly reason?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * IP 검증 서비스 인터페이스
 */
export interface IIpValidationService {
  validate(ip: string): Promise<IpValidationResult>;
  blacklist(ip: string, reason: string, ttl?: number): Promise<void>;
  whitelist(ip: string): Promise<void>;
  isBlacklisted(ip: string): Promise<boolean>;
  getBlacklistedIps(): Promise<string[]>;
}

/**
 * 보안 검증 결과
 */
export interface SecurityCheckResult {
  readonly passed: boolean;
  readonly failureReason?: string;
  readonly riskScore?: number;
  readonly metadata?: Record<string, any>;
}

/**
 * 보안 검증 전략 인터페이스
 */
export interface ISecurityStrategy {
  readonly name: string;
  readonly priority: number;
  validate(context: IRequestContext): Promise<SecurityCheckResult>;
}

/**
 * 요청 컨텍스트 인터페이스
 */
export interface IRequestContext {
  readonly ip: string;
  readonly userAgent: string;
  readonly path: string;
  readonly method: string;
  readonly headers: Record<string, any>;
  readonly body?: any;
  readonly timestamp: Date;
  readonly sessionId?: string;
}

/**
 * Rate Limiting 인터페이스
 */
export interface IRateLimiter {
  checkLimit(key: string): Promise<RateLimitResult>;
  consume(key: string, points?: number): Promise<void>;
  reset(key: string): Promise<void>;
  getStatus(key: string): Promise<RateLimitStatus>;
}

/**
 * Rate Limit 결과
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly limit: number;
}

/**
 * Rate Limit 상태
 */
export interface RateLimitStatus {
  readonly consumed: number;
  readonly remaining: number;
  readonly resetAt: Date;
}

/**
 * 캐시 인터페이스
 */
export interface ICache<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * 로거 인터페이스
 */
export interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
}

/**
 * 메트릭 수집기 인터페이스
 */
export interface IMetricsCollector {
  increment(metric: string, tags?: Record<string, string>): void;
  decrement(metric: string, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
}

/**
 * 이벤트 발행자 인터페이스
 */
export interface IEventPublisher {
  publish<T = any>(event: string, data: T): Promise<void>;
  subscribe<T = any>(event: string, handler: (data: T) => void): void;
  unsubscribe(event: string, handler: Function): void;
}

/**
 * 설정 인터페이스
 */
export interface IConfiguration {
  get<T = any>(key: string, defaultValue?: T): T;
  has(key: string): boolean;
  getAll(): Record<string, any>;
}
