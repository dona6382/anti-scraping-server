import * as crypto from 'crypto';
import { Request } from 'express';
import { RequestUtils } from './request.utils';

/**
 * Security Utilities
 * 보안 관련 유틸리티 함수들
 * 
 * Note: IP 추출 로직은 RequestUtils로 이동됨 (중복 제거)
 */

/**
 * IP 주소 추출 (RequestUtils 사용)
 * @deprecated Use RequestUtils.extractClientIp instead
 */
export function extractClientIp(request: Request): string {
  return RequestUtils.extractClientIp(request);
}

/**
 * IP 주소 유효성 검사 (RequestUtils 사용)
 * @deprecated Use RequestUtils.isValidIpAddress instead
 */
export function isValidIpAddress(ip: string): boolean {
  return RequestUtils.isValidIpAddress(ip);
}

/**
 * 프라이빗 IP 확인
 */
export function isPrivateIp(ip: string): boolean {
  const privateRanges = [
    /^10\./,                              // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // 172.16.0.0/12
    /^192\.168\./,                        // 192.168.0.0/16
    /^127\./,                             // 127.0.0.0/8 (loopback)
    /^::1$/,                              // IPv6 loopback
    /^fe80:/,                             // IPv6 link-local
    /^fc00:/,                             // IPv6 unique local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * 해시 생성
 */
export function generateHash(
  data: string,
  algorithm: string = 'sha256'
): string {
  return crypto
    .createHash(algorithm)
    .update(data)
    .digest('hex');
}

/**
 * 보안 토큰 생성
 */
export function generateSecureToken(length: number = 32): string {
  return crypto
    .randomBytes(length)
    .toString('hex');
}

/**
 * Request Fingerprint 생성
 */
export function generateRequestFingerprint(request: Request): string {
  const components = [
    request.headers['user-agent'] || '',
    request.headers['accept-language'] || '',
    request.headers['accept-encoding'] || '',
    request.headers['accept'] || '',
    RequestUtils.extractClientIp(request), // RequestUtils 사용
  ];

  return generateHash(components.join('|'));
}

/**
 * Rate Limit 키 생성
 */
export function generateRateLimitKey(
  ip: string,
  endpoint?: string,
  userId?: string
): string {
  const parts = ['rate_limit', ip];
  
  if (userId) {
    parts.push(`user:${userId}`);
  }
  
  if (endpoint) {
    parts.push(`endpoint:${endpoint}`);
  }
  
  return parts.join(':');
}

/**
 * CSRF 토큰 생성
 */
export function generateCsrfToken(): string {
  return generateSecureToken(24);
}

/**
 * SQL Injection 패턴 감지
 */
export function detectSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi,
    /(\b(OR|AND)\b\s*\d+\s*=\s*\d+)/gi,
    /(--|\#|\/\*|\*\/)/g,
    /(\bEXEC(UTE)?\b|\bCAST\b|\bDECLARE\b)/gi,
    /(\'|\"|;|\||\\)/g,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * XSS 패턴 감지
 */
export function detectXss(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /<img[^>]*src[^>]*>/gi,
    /eval\s*\(/gi,
    /alert\s*\(/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * 안전한 리다이렉트 URL 검증
 */
export function isSafeRedirectUrl(
  url: string,
  allowedDomains: string[]
): boolean {
  try {
    const parsed = new URL(url);
    
    // 프로토콜 검사
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // 도메인 검사
    return allowedDomains.some(domain => 
      parsed.hostname === domain || 
      parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    // 상대 경로는 허용
    return url.startsWith('/') && !url.startsWith('//');
  }
}

/**
 * 민감한 데이터 마스킹
 */
export function maskSensitiveData(
  data: string,
  type: 'email' | 'phone' | 'card' | 'custom' = 'custom',
  visibleChars: number = 4
): string {
  if (!data || data.length <= visibleChars) {
    return data;
  }

  switch (type) {
    case 'email': {
      const [local, domain] = data.split('@');
      if (!domain || !local) return data;
      const maskedLocal = local.substring(0, 2) + '***';
      return `${maskedLocal}@${domain}`;
    }
    
    case 'phone': {
      const digits = data.replace(/\D/g, '');
      if (digits.length < 10) return data;
      return digits.substring(0, 3) + '****' + digits.substring(digits.length - 4);
    }
    
    case 'card': {
      const digits = data.replace(/\D/g, '');
      if (digits.length < 12) return data;
      return '**** **** **** ' + digits.substring(digits.length - 4);
    }
    
    default: {
      const visibleStart = Math.floor(visibleChars / 2);
      const visibleEnd = visibleChars - visibleStart;
      return (
        data.substring(0, visibleStart) +
        '*'.repeat(data.length - visibleChars) +
        data.substring(data.length - visibleEnd)
      );
    }
  }
}