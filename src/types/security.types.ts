/**
 * Security Related Type Definitions
 */

import { Request } from 'express';

/**
 * Client Information
 */
export interface ClientInfo {
  ip: string;
  userAgent: string;
  acceptLanguage?: string | undefined;
  acceptEncoding?: string | undefined;
  host?: string | undefined;
  origin?: string | undefined;
  referer?: string | undefined;
}

/**
 * Security Context for Request
 */
export interface SecurityContext {
  ip: string;
  userAgent: string;
  fingerprint?: string;
  riskScore?: number;
  flags: SecurityFlags;
  timestamp: number;
  requestId: string;
}

/**
 * Security Flags
 */
export interface SecurityFlags {
  isBot?: boolean;
  isHeadless?: boolean;
  isBlocked?: boolean;
  isSuspicious?: boolean;
  hasValidRecaptcha?: boolean;
  honeypotTriggered?: boolean;
}

/**
 * Extended Request with Security Context
 */
export interface ExtendedRequest extends Request {
  clientInfo?: ClientInfo;
  securityContext?: SecurityContext;
  requestId?: string;
  timestamp?: number;
  recaptchaToken?: string;
  honeypotData?: Record<string, unknown>;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Block Information
 */
export interface BlockInfo {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Rate Limit Info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Cache Entry
 */
export interface CacheEntry<T = unknown> {
  value: T;
  ttl?: number;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Security Guard Result
 */
export interface GuardResult {
  allowed: boolean;
  guardName: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error Details
 */
export interface ErrorDetails {
  reason: string;
  code?: string;
  metadata?: Record<string, unknown>;
}
