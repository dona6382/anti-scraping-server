import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ExtendedRequest } from '../../types';

/**
 * Base Security Guard
 * 모든 보안 가드의 공통 기능을 제공하는 기본 클래스
 */
@Injectable()
export abstract class BaseSecurityGuard implements CanActivate {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * 추상 메서드 - 각 Guard에서 구현해야 함
   */
  abstract canActivate(context: ExecutionContext): boolean | Promise<boolean>;

  /**
   * 가드 이름 반환 (로깅용)
   */
  protected abstract getGuardName(): string;

  /**
   * 요청 검증 로직 (각 가드에서 구현)
   */
  protected abstract validateRequest(request: ExtendedRequest): boolean | Promise<boolean>;

  /**
   * 실패 메시지 생성 (각 가드에서 구현)
   */
  protected abstract getFailureMessage(request: ExtendedRequest): string;

  /**
   * 클라이언트 IP 주소 추출
   */
  protected getClientIp(request: ExtendedRequest): string {
    // X-Forwarded-For 헤더에서 첫 번째 IP 추출
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (ips) {
        return ips.split(',')[0]?.trim() || 'unknown';
      }
    }

    // X-Real-IP 헤더 확인
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? (realIp[0] || 'unknown') : (realIp || 'unknown');
    }

    // X-Client-IP 헤더 확인
    const clientIp = request.headers['x-client-ip'];
    if (clientIp) {
      return Array.isArray(clientIp) ? (clientIp[0] || 'unknown') : (clientIp || 'unknown');
    }

    // 기본 IP 주소들 확인
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * User-Agent 추출
   */
  protected getUserAgent(request: ExtendedRequest): string {
    const userAgent = request.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] || '' : userAgent || '';
  }

  /**
   * 요청 식별자 생성
   */
  protected generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 요청 정보 로깅
   */
  protected logRequest(request: ExtendedRequest, message: string): void {
    const ip = this.getClientIp(request);
    const userAgent = this.getUserAgent(request).substring(0, 50);
    const method = request.method;
    const url = request.url;

    this.logger.log(`${message} - ${method} ${url} - IP: ${ip}, UA: ${userAgent}`);
  }

  /**
   * 보안 위반 로깅
   */
  protected logSecurityViolation(request: ExtendedRequest, reason: string): void {
    const ip = this.getClientIp(request);
    const userAgent = this.getUserAgent(request).substring(0, 100);
    const method = request.method;
    const url = request.url;

    this.logger.warn(`Security violation: ${reason} - ${method} ${url} - IP: ${ip}, UA: ${userAgent}`);
  }

  /**
   * 요청 헤더 안전하게 가져오기
   */
  protected getHeader(request: ExtendedRequest, headerName: string): string | undefined {
    const header = request.headers[headerName.toLowerCase()];
    return Array.isArray(header) ? header[0] : header;
  }

  /**
   * 요청 바디 안전하게 가져오기
   */
  protected getRequestBody(request: ExtendedRequest): Record<string, unknown> {
    return request.body || {};
  }

  /**
   * 요청 쿼리 파라미터 안전하게 가져오기
   */
  protected getQueryParams(request: ExtendedRequest): Record<string, string | string[]> {
    return (request.query as Record<string, string | string[]>) || {};
  }

  /**
   * 요청이 HTTPS인지 확인
   */
  protected isHttps(request: ExtendedRequest): boolean {
    return (
      (request as any).protocol === 'https' ||
      this.getHeader(request, 'x-forwarded-proto') === 'https' ||
      this.getHeader(request, 'x-forwarded-ssl') === 'on'
    );
  }

  /**
   * 요청이 모바일 디바이스에서 온 것인지 확인
   */
  protected isMobileDevice(request: ExtendedRequest): boolean {
    const userAgent = this.getUserAgent(request).toLowerCase();
    const mobilePatterns = [
      'mobile',
      'android',
      'iphone',
      'ipad',
      'ipod',
      'blackberry',
      'windows phone',
      'opera mini',
      'opera mobi',
    ];

    return mobilePatterns.some(pattern => userAgent.includes(pattern));
  }

  /**
   * 요청 크기 확인 (대략적)
   */
  protected getRequestSize(request: ExtendedRequest): number {
    const contentLength = this.getHeader(request, 'content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  /**
   * 요청 시간 측정을 위한 타임스탬프 설정
   */
  protected setRequestTimestamp(request: ExtendedRequest): void {
    (request as any).__requestTimestamp = Date.now();
  }

  /**
   * 요청 처리 시간 계산
   */
  protected getRequestDuration(request: ExtendedRequest): number {
    const timestamp = (request as any).__requestTimestamp;
    return timestamp ? Date.now() - timestamp : 0;
  }

  /**
   * 안전한 JSON 파싱
   */
  protected safeJsonParse<T = unknown>(jsonString: string): T | null {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }

  /**
   * IP 주소 유효성 검사
   */
  protected isValidIpAddress(ip: string): boolean {
    // IPv4 패턴
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 패턴 (간단한 버전)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    return ipv6Regex.test(ip);
  }

  /**
   * 프라이빗 IP 주소인지 확인
   */
  protected isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * 요청 메타데이터 생성
   */
  protected createRequestMetadata(request: ExtendedRequest): Record<string, unknown> {
    return {
      ip: this.getClientIp(request),
      userAgent: this.getUserAgent(request),
      method: request.method,
      url: request.url,
      isHttps: this.isHttps(request),
      isMobile: this.isMobileDevice(request),
      requestSize: this.getRequestSize(request),
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
    };
  }

  /**
   * 표준화된 보안 에러 생성
   */
  protected createSecurityError(
    request: ExtendedRequest,
    reason: string,
    statusCode: number = 403
  ): {
    message: string;
    statusCode: number;
    metadata: Record<string, unknown>;
  } {
    return {
      message: this.getFailureMessage(request),
      statusCode,
      metadata: {
        reason,
        guard: this.getGuardName(),
        ...this.createRequestMetadata(request),
      },
    };
  }
}
