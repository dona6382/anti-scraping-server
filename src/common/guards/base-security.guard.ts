import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ExtendedRequest } from '../../core/types';
import { RequestUtils } from '../utils/request.utils';

/**
 * Base Security Guard
 * 보안 가드의 공통 기능을 제공하는 기본 클래스
 */
@Injectable()
export abstract class BaseSecurityGuard implements CanActivate {
  protected readonly logger = new Logger(this.constructor.name);

  abstract canActivate(context: ExecutionContext): boolean | Promise<boolean>;

  /**
   * 클라이언트 IP 추출
   */
  protected getClientIp(request: ExtendedRequest): string {
    return RequestUtils.extractClientIp(request);
  }

  /**
   * User-Agent 추출
   */
  protected getUserAgent(request: ExtendedRequest): string {
    return RequestUtils.extractUserAgent(request);
  }

  /**
   * 헤더 값 추출
   */
  protected getHeader(request: ExtendedRequest, headerName: string): string | undefined {
    return RequestUtils.extractHeader(request, headerName);
  }

  /**
   * IP 유효성 검사
   */
  protected isValidIpAddress(ip: string): boolean {
    return RequestUtils.isValidIpAddress(ip);
  }

  /**
   * 보안 위반 로깅
   */
  protected logSecurityViolation(request: ExtendedRequest, reason: string): void {
    const ip = this.getClientIp(request);
    const userAgent = this.getUserAgent(request).substring(0, 100);

    this.logger.warn(
      `Security violation: ${reason} - ${request.method} ${request.url} - IP: ${ip}, UA: ${userAgent}`,
    );
  }
}
