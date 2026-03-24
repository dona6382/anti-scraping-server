/**
 * Common Types for Anti-Scraping Server
 */

import { Request } from 'express';

// Extended Request
export interface ExtendedRequest extends Omit<Request, 'connection' | 'socket'> {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  method: string;
  url: string;
  query: Record<string, string | string[] | undefined>;
  connection?: { remoteAddress?: string };
  socket?: { remoteAddress?: string };
  clientInfo?: ClientInfo;
  securityContext?: SecurityContext;
  requestId?: string;
  timestamp?: number;

  honeypotData?: Record<string, unknown>;
}

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

export interface SecurityContext {
  guardsExecuted: string[];
  guardsBlocked: string[];
  violations: SecurityViolation[];
  metadata: Record<string, unknown>;
}

// Security types
export type SecurityReason =
  | 'MANUAL_ADMIN_ACTION'
  | 'BOT_DETECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_BEHAVIOR'
  | 'HONEYPOT_TRIGGERED'
  | 'INVALID_USER_AGENT'
  | 'HEADLESS_BROWSER_DETECTED';

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

// API Response
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T | undefined;
  message?: string | undefined;
  timestamp: string;
  code?: string | undefined;
  details?: unknown;
}

// Statistics
export interface IpStatistics {
  totalBlocked: number;
  recentBlocks: number;
  topReasons: Record<string, number>;
  redisConnected?: boolean;
}

// Re-export cache interface from single source
export type { ICacheService } from '../cache/interfaces/cache.interface';
