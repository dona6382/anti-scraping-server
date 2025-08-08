import { CanActivate, ExecutionContext, Logger, ForbiddenException } from '@nestjs/common';
import { IpExtractor, LogUtil } from '../utils/security.utils';
import { ERROR_MESSAGES } from '../constants/security.constants';

/**
 * 모든 Guard의 기본 클래스
 * 공통 기능을 제공합니다.
 */
export abstract class BaseGuard implements CanActivate {
  protected abstract readonly logger: Logger;
  protected abstract readonly guardName: string;

  /**
   * Guard 실행
   */
  abstract canActivate(context: ExecutionContext): boolean | Promise<boolean>;

  /**
   * Request 객체 추출
   */
  protected getRequest(context: ExecutionContext): any {
    return context.switchToHttp().getRequest();
  }

  /**
   * Response 객체 추출
   */
  protected getResponse(context: ExecutionContext): any {
    return context.switchToHttp().getResponse();
  }

  /**
   * IP 주소 추출
   */
  protected extractIp(context: ExecutionContext): string {
    const request = this.getRequest(context);
    return IpExtractor.extract(request);
  }

  /**
   * 차단 처리
   */
  protected block(reason: string, details: Record<string, any>, errorMessage?: string): never {
    this.logger.warn(LogUtil.blocked(reason, details));
    throw new ForbiddenException(errorMessage || ERROR_MESSAGES.ACCESS_DENIED);
  }

  /**
   * 경고 로그
   */
  protected warn(message: string, details?: Record<string, any>): void {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    this.logger.warn(`[${this.guardName}] ${message}${detailsStr}`);
  }

  /**
   * 디버그 로그
   */
  protected debug(message: string, details?: Record<string, any>): void {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    this.logger.debug(`[${this.guardName}] ${message}${detailsStr}`);
  }

  /**
   * User-Agent 추출
   */
  protected getUserAgent(context: ExecutionContext): string {
    const request = this.getRequest(context);
    return request.headers?.['user-agent'] || '';
  }

  /**
   * Request body 추출
   */
  protected getBody(context: ExecutionContext): any {
    const request = this.getRequest(context);
    return request.body || {};
  }

  /**
   * Request method 추출
   */
  protected getMethod(context: ExecutionContext): string {
    const request = this.getRequest(context);
    return request.method;
  }

  /**
   * Request path 추출
   */
  protected getPath(context: ExecutionContext): string {
    const request = this.getRequest(context);
    return request.path || request.url || '';
  }

  /**
   * Request에 메타데이터 추가
   */
  protected setRequestMetadata(context: ExecutionContext, key: string, value: any): void {
    const request = this.getRequest(context);
    if (!request.metadata) {
      request.metadata = {};
    }
    request.metadata[key] = value;
  }

  /**
   * Request에서 메타데이터 가져오기
   */
  protected getRequestMetadata(context: ExecutionContext, key: string): any {
    const request = this.getRequest(context);
    return request.metadata?.[key];
  }
}
