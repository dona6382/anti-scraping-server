import { Request } from 'express';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

/**
 * IP 주소 추출 유틸리티
 */
export class IpExtractor {
  /**
   * Request 객체에서 실제 클라이언트 IP 추출
   */
  static extract(request: Request | any): string {
    // Priority order for IP extraction
    for (const header of SECURITY_CONSTANTS.HEADERS.IP) {
      const value = request.headers?.[header];
      if (value) {
        // Handle comma-separated IPs (first one is the original client)
        if (header === 'x-forwarded-for' && typeof value === 'string') {
          const ips = value.split(',').map((ip) => ip.trim());
          const clientIp = ips[0];
          return this.normalizeIp(clientIp);
        }
        return this.normalizeIp(value as string);
      }
    }

    // Fallback to direct connection
    const directIp =
      request.ip ||
      request.socket?.remoteAddress ||
      request.connection?.remoteAddress ||
      request.connection?.socket?.remoteAddress;

    return this.normalizeIp(directIp);
  }

  /**
   * IP 주소 정규화 (IPv6 형식 처리)
   */
  private static normalizeIp(ip: string | undefined): string {
    if (!ip) return '';

    // Remove IPv6 prefix for IPv4 addresses
    if (ip.includes('::ffff:')) {
      return ip.replace('::ffff:', '');
    }

    // Handle IPv6 localhost
    if (ip === '::1') {
      return '127.0.0.1';
    }

    return ip;
  }

  /**
   * IP가 프라이빗 주소인지 확인
   */
  static isPrivate(ip: string): boolean {
    const privateRanges = [
      /^127\./, // 127.0.0.0/8
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^::1$/, // IPv6 localhost
      /^fe80::/, // IPv6 link-local
      /^fc00::/, // IPv6 unique local
    ];

    return privateRanges.some((range) => range.test(ip));
  }

  /**
   * 프록시 헤더 존재 여부 확인
   */
  static hasProxyHeaders(request: Request | any): boolean {
    return SECURITY_CONSTANTS.HEADERS.PROXY.some(
      (header) => request.headers?.[header] !== undefined,
    );
  }
}

/**
 * User-Agent 유틸리티
 */
export class UserAgentUtil {
  /**
   * User-Agent 문자열 정규화
   */
  static normalize(userAgent: string | undefined): string {
    if (!userAgent) return '';
    return userAgent.toLowerCase().trim();
  }

  /**
   * 유효한 User-Agent 길이인지 확인
   */
  static isValidLength(userAgent: string): boolean {
    return (
      userAgent.length >= SECURITY_CONSTANTS.USER_AGENT.MIN_LENGTH &&
      userAgent.length <= SECURITY_CONSTANTS.USER_AGENT.MAX_LENGTH
    );
  }

  /**
   * 브라우저 User-Agent인지 확인
   */
  static isBrowser(userAgent: string): boolean {
    const keywords = ['Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Trident'];
    return keywords.some((keyword) => userAgent.includes(keyword));
  }

  /**
   * 모바일 User-Agent인지 확인
   */
  static isMobile(userAgent: string): boolean {
    const mobileKeywords = ['Mobile', 'Android', 'iPhone', 'iPad', 'Windows Phone'];
    return mobileKeywords.some((keyword) => userAgent.includes(keyword));
  }
}

/**
 * 시간 관련 유틸리티
 */
export class TimeUtil {
  /**
   * 타임스탬프가 유효한 범위 내에 있는지 확인
   */
  static isTimestampValid(timestamp: number, maxAgeMs: number): boolean {
    const now = Date.now();
    const age = now - timestamp;
    return age > 0 && age < maxAgeMs;
  }

  /**
   * TTL을 밀리초로 변환
   */
  static secondsToMs(seconds: number): number {
    return seconds * 1000;
  }

  /**
   * 밀리초를 초로 변환
   */
  static msToSeconds(ms: number): number {
    return Math.floor(ms / 1000);
  }
}

/**
 * 보안 관련 유틸리티
 */
export class SecurityUtil {
  /**
   * Honeypot 필드명 생성
   */
  static generateHoneypotFieldName(): string {
    const names = ['email_confirm', 'name_confirm', 'phone_verify', 'url_field', 'website', 'fax'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * 간단한 토큰 생성
   */
  static generateToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}:${random}`;
  }

  /**
   * 토큰 검증
   */
  static validateToken(token: string, maxAgeMs: number = 3600000): boolean {
    if (!token || !token.includes(':')) return false;

    const [timestampStr] = token.split(':');
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) return false;

    return TimeUtil.isTimestampValid(timestamp, maxAgeMs);
  }

  /**
   * Request body에서 민감한 필드 제거
   */
  static sanitizeBody(body: any): any {
    const sensitiveFields = [
      'email_confirm',
      'recaptchaToken',
      '_timestamp',
      '_jsToken',
      '_browserProps',
      '_webdriver',
      '_fingerprint',
      'g_recaptcha_response',
      'website',
      'phone_verify',
      'url_field',
      'fax',
    ];

    const sanitized = { ...body };
    sensitiveFields.forEach((field) => delete sanitized[field]);

    return sanitized;
  }
}

/**
 * 로깅 유틸리티
 */
export class LogUtil {
  /**
   * 차단 로그 메시지 생성
   */
  static blocked(reason: string, details: Record<string, any>): string {
    const detailsStr = Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return `[BLOCKED] ${reason} - ${detailsStr}`;
  }

  /**
   * IP 마스킹 (로그용)
   */
  static maskIp(ip: string): string {
    if (!ip) return 'unknown';

    const parts = ip.split('.');
    if (parts.length === 4) {
      // IPv4: 192.168.1.xxx
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }

    // IPv6 or other: show first part only
    const firstPart = ip.split(':')[0];
    return `${firstPart}:xxxx`;
  }

  /**
   * User-Agent 축약 (로그용)
   */
  static truncateUserAgent(userAgent: string, maxLength: number = 50): string {
    if (!userAgent) return 'none';
    if (userAgent.length <= maxLength) return userAgent;
    return userAgent.substring(0, maxLength) + '...';
  }
}
