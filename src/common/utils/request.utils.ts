import { createHash } from 'crypto';
import { ExtendedRequest } from '../../core/types';
import { BOT_PATTERNS, CRAWLER_PATTERNS, MOBILE_PATTERNS, TABLET_PATTERNS } from '../constants/security.constants';

/**
 * Request Utilities
 * 요청 정보 추출을 위한 유틸리티 함수들
 */
export class RequestUtils {
  /**
   * 클라이언트 IP 주소 추출
   */
  /**
   * Express의 trust proxy 설정을 통해 안전하게 처리된 request.ip를 우선 사용.
   * 프록시 헤더를 직접 파싱하지 않음 — Express가 trust proxy 기반으로 처리.
   * main.ts에서 app.set('trust proxy', ...) 설정 필요.
   */
  static extractClientIp(request: ExtendedRequest): string {
    // Express가 trust proxy 설정에 따라 안전하게 결정한 IP
    if (request.ip) {
      return request.ip;
    }

    // Socket에서 직접 가져오기 (fallback)
    const socket = request.socket;
    if (socket?.remoteAddress) {
      return socket.remoteAddress;
    }

    return 'unknown';
  }

  /**
   * User-Agent 추출
   */
  static extractUserAgent(request: ExtendedRequest): string {
    const userAgent = request.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] || '' : userAgent || '';
  }

  /**
   * 특정 헤더 추출
   */
  static extractHeader(request: ExtendedRequest, headerName: string): string | undefined {
    const header = request.headers[headerName.toLowerCase()];
    return Array.isArray(header) ? header[0] : header;
  }

  /**
   * IP 주소 유효성 검사
   */
  static isValidIpAddress(ip: string): boolean {
    if (!ip || ip === 'unknown') {
      return false;
    }

    // IPv4 정규식
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 정규식 (간단한 버전)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * IP를 정규화 (IPv6 축약형 등 처리)
   */
  static normalizeIp(ip: string): string {
    // ::ffff:192.168.1.1 형식의 IPv4-mapped IPv6 주소를 IPv4로 변환
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }

    // ::1 (IPv6 localhost)를 127.0.0.1로 변환
    if (ip === '::1') {
      return '127.0.0.1';
    }

    return ip;
  }

  /**
   * IP 해시화 (로깅/개인정보 보호용)
   */
  static hashIp(ip: string, salt: string): string {
    return createHash('sha256')
      .update(ip + salt)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 프라이빗 IP 주소인지 확인
   */
  static isPrivateIp(ip: string): boolean {
    const normalizedIp = this.normalizeIp(ip);
    
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fd[0-9a-f]{2}:/i,
    ];

    return privateRanges.some(range => range.test(normalizedIp));
  }

  /**
   * 봇 User-Agent 확인
   */
  static isBotUserAgent(userAgent: string): boolean {
    return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
  }

  /**
   * 크롤러 User-Agent 확인
   */
  static isCrawlerUserAgent(userAgent: string): boolean {
    return CRAWLER_PATTERNS.some(pattern => pattern.test(userAgent));
  }

  /**
   * 모바일 디바이스인지 확인
   */
  static isMobileDevice(userAgent: string): boolean {
    return MOBILE_PATTERNS.some(pattern => pattern.test(userAgent));
  }

  /**
   * 태블릿 디바이스인지 확인
   */
  static isTabletDevice(userAgent: string): boolean {
    return TABLET_PATTERNS.some(pattern => pattern.test(userAgent));
  }

  /**
   * 디바이스 타입 탐지
   */
  static detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' {
    if (this.isBotUserAgent(userAgent)) return 'bot';
    if (this.isMobileDevice(userAgent)) return 'mobile';
    if (this.isTabletDevice(userAgent)) return 'tablet';
    return 'desktop';
  }
}
