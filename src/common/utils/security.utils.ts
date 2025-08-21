import * as crypto from 'crypto';
import { Request } from 'express';

/**
 * Security Utilities
 * 보안 관련 유틸리티 함수들
 */

/**
 * IP 주소 추출 (통합)
 */
export function extractClientIp(request: Request): string {
  // X-Forwarded-For 헤더 확인
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (ips) {
      return ips.split(',')[0]?.trim() || 'unknown';
    }
  }

  // 다른 프록시 헤더들 확인
  const proxyHeaders = [
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'true-client-ip', // Cloudflare Enterprise
    'x-cluster-client-ip',
  ];

  for (const header of proxyHeaders) {
    const value = request.headers[header];
    if (value) {
      const headerValue = Array.isArray(value) ? value[0] : value;
      if (headerValue) {
        return headerValue;
      }
    }
  }

  // 기본 IP 주소
  return (
    (request as any).connection?.remoteAddress ||
    (request as any).socket?.remoteAddress ||
    request.ip ||
    'unknown'
  );
}

/**
 * IP 주소 유효성 검사
 */
export function isValidIpAddress(ip: string): boolean {
  // IPv4 패턴
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 패턴 (간단한 검증)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
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
 * 비밀번호 해싱 (bcrypt 대신 crypto 사용)
 */
export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512')
    .toString('hex');
  
  return `${actualSalt}:${hash}`;
}

/**
 * 비밀번호 검증
 */
export function verifyPassword(
  password: string,
  hashedPassword: string
): boolean {
  const parts = hashedPassword.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  const [salt, hash] = parts;
  if (!salt || !hash) {
    return false;
  }
  
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  
  return hash === verifyHash;
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
    extractClientIp(request),
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
 * 시간 기반 OTP 생성
 */
export function generateTOTP(
  secret: string,
  window: number = 30
): string {
  try {
    const counter = Math.floor(Date.now() / 1000 / window);
    const hmac = crypto
      .createHmac('sha1', secret)
      .update(Buffer.from(counter.toString()))
      .digest();
    
    if (!hmac || hmac.length < 20) {
      return '000000';
    }
    
    // 마지막 바이트를 안전하게 가져오기
    const lastByte = hmac[hmac.length - 1];
    if (lastByte === undefined) {
      return '000000';
    }
    
    const offset = lastByte & 0xf;
    
    // 범위 체크 - HMAC-SHA1은 20바이트이므로 offset + 3 < 20이어야 함
    if (offset + 3 >= hmac.length) {
      return '000000';
    }
    
    // 각 바이트를 안전하게 가져오기
    const byte1 = hmac[offset];
    const byte2 = hmac[offset + 1];
    const byte3 = hmac[offset + 2];
    const byte4 = hmac[offset + 3];
    
    if (byte1 === undefined || byte2 === undefined || byte3 === undefined || byte4 === undefined) {
      return '000000';
    }
    
    const code = (
      ((byte1 & 0x7f) << 24) |
      ((byte2 & 0xff) << 16) |
      ((byte3 & 0xff) << 8) |
      (byte4 & 0xff)
    ) % 1000000;
    
    return code.toString().padStart(6, '0');
  } catch (error) {
    // 에러 발생 시 기본값 반환
    return '000000';
  }
}

/**
 * CSRF 토큰 생성
 */
export function generateCsrfToken(): string {
  return generateSecureToken(24);
}

/**
 * CSRF 토큰 검증
 */
export function verifyCsrfToken(
  token: string,
  sessionToken: string
): boolean {
  if (!token || !sessionToken) {
    return false;
  }
  
  // 타이밍 공격 방지를 위한 안전한 비교
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
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
