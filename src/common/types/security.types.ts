/**
 * 공통 타입 정의
 */

export interface IpInfo {
  ip: string;
  reason: string;
  timestamp: string;
  ttl?: number;
}

export interface BlacklistStats {
  totalBlacklisted: number;
  memoryBlacklisted: number;
  redisConnected: boolean;
}

export interface RecaptchaConfig {
  secretKey: string;
  scoreThreshold: number;
  failOpen?: boolean;
  allowedHostnames?: string[];
}

export interface RecaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challengeTimestamp?: string;
  errorCodes?: string[];
}

export interface GoogleRecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export interface BrowserFingerprint {
  webdriver: boolean;
  headless: boolean;
  automation: boolean;
  plugins: string[];
  languages: string[];
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  canvas?: string;
  webgl?: {
    vendor: string;
    renderer: string;
  };
  chrome?: {
    runtime: boolean;
    loadTimes: boolean;
  };
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface SecurityMetrics {
  blockedByUserAgent: number;
  blockedByIp: number;
  blockedByHoneypot: number;
  blockedByRecaptcha: number;
  blockedByHeadless: number;
  rateLimitHits: number;
  timestamp: Date;
}

export enum BlockReason {
  USER_AGENT = 'user_agent',
  IP_BLACKLIST = 'ip_blacklist',
  HONEYPOT = 'honeypot',
  RECAPTCHA = 'recaptcha',
  HEADLESS = 'headless',
  RATE_LIMIT = 'rate_limit',
  PROXY = 'proxy',
  MANUAL = 'manual',
}

export enum GuardType {
  USER_AGENT = 'UserAgentGuard',
  IP_BLACKLIST = 'IpBlacklistGuard',
  HONEYPOT = 'HoneypotGuard',
  RECAPTCHA = 'RecaptchaGuard',
  HEADLESS = 'HeadlessBrowserGuard',
}
