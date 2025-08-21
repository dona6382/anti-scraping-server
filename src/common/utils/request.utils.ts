import { Request } from 'express';
import { ExtendedRequest } from '../../types';
import * as crypto from 'crypto';

/**
 * Request Utility Class
 * HTTP 요청 관련 공통 유틸리티 함수들
 * 
 * 중복 코드 제거:
 * - IP 추출 로직 (5곳 이상에서 사용)
 * - User-Agent 추출 로직 (여러 Guard에서 사용)
 * - 헤더 추출 로직
 */
export class RequestUtils {
  /**
   * 클라이언트 IP 주소 추출
   * 프록시를 고려한 실제 IP 주소 반환
   */
  static extractClientIp(request: Request | ExtendedRequest): string {
    // X-Forwarded-For 헤더 확인 (프록시/로드밸런서 환경)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips ? (ips.split(',')[0]?.trim() || 'unknown') : 'unknown';
    }

    // X-Real-IP 헤더 확인 (Nginx 등)
    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    // CloudFlare 헤더 확인
    const cfConnectingIp = request.headers['cf-connecting-ip'];
    if (cfConnectingIp && typeof cfConnectingIp === 'string') {
      return cfConnectingIp;
    }

    // 기본 IP
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * User-Agent 헤더 추출
   */
  static extractUserAgent(request: Request | ExtendedRequest): string {
    const userAgent = request.headers['user-agent'];
    return (typeof userAgent === 'string' ? userAgent : '') || '';
  }

  /**
   * 특정 헤더 값 추출 (안전하게)
   */
  static extractHeader(request: Request | ExtendedRequest, headerName: string): string | undefined {
    const value = request.headers[headerName.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Accept-Language 헤더 추출
   */
  static extractAcceptLanguage(request: Request | ExtendedRequest): string {
    return this.extractHeader(request, 'accept-language') || '';
  }

  /**
   * Referer 헤더 추출
   */
  static extractReferer(request: Request | ExtendedRequest): string {
    return this.extractHeader(request, 'referer') || '';
  }

  /**
   * IP 주소 해시화 (로깅/저장용)
   * GDPR 등 개인정보 보호 규정 준수
   */
  static hashIp(ip: string, salt?: string): string {
    const actualSalt = salt || process.env.IP_HASH_SALT || 'default-salt';
    return crypto
      .createHash('sha256')
      .update(ip + actualSalt)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * IP 주소 마스킹 (부분 숨김)
   * 예: 192.168.1.100 -> 192.168.*.* 
   */
  static maskIp(ip: string): string {
    if (ip === 'unknown' || !ip) return 'unknown';
    
    // IPv4 처리
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.*`;
      }
    }
    
    // IPv6 처리
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts[0]}:${parts[1]}:${parts[2]}:****`;
      }
    }
    
    return 'masked';
  }

  /**
   * User-Agent 정제 (민감 정보 제거)
   */
  static sanitizeUserAgent(userAgent: string): string {
    // 버전 정보 제거
    return userAgent
      .replace(/\/[\d.]+/g, '/x.x')
      .substring(0, 150);
  }

  /**
   * IP 주소 유효성 검사
   */
  static isValidIpAddress(ip: string): boolean {
    if (!ip || ip === 'unknown') return false;

    // IPv4 패턴
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 패턴 (간단화)
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
  }

  /**
   * 요청 메타데이터 추출 (로깅용)
   */
  static extractRequestMetadata(request: Request | ExtendedRequest): Record<string, unknown> {
    return {
      method: request.method,
      url: request.url,
      path: request.path,
      ip: this.maskIp(this.extractClientIp(request)),
      userAgent: this.sanitizeUserAgent(this.extractUserAgent(request)),
      referer: this.extractReferer(request),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 보안 헤더 확인
   */
  static hasSecurityHeaders(request: Request | ExtendedRequest): {
    hasHeaders: boolean;
    missing: string[];
  } {
    const requiredHeaders = [
      'accept',
      'accept-encoding',
      'accept-language',
      'user-agent',
    ];

    const missing = requiredHeaders.filter(
      header => !request.headers[header]
    );

    return {
      hasHeaders: missing.length === 0,
      missing,
    };
  }

  /**
   * 봇/크롤러 User-Agent 패턴 확인
   */
  static isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /ruby/i,
      /perl/i,
      /php/i,
    ];

    const lowerUserAgent = userAgent.toLowerCase();
    return botPatterns.some(pattern => pattern.test(lowerUserAgent));
  }

  /**
   * 알려진 정상 봇 확인
   */
  static isKnownGoodBot(userAgent: string): boolean {
    const goodBots = [
      'googlebot',
      'bingbot',
      'slackbot',
      'twitterbot',
      'facebookexternalhit',
      'linkedinbot',
      'whatsapp',
      'telegram',
      'discordbot',
    ];

    const lowerUserAgent = userAgent.toLowerCase();
    return goodBots.some(bot => lowerUserAgent.includes(bot));
  }
}
