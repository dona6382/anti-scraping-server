import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';

/**
 * Base Security Guard
 * 모든 보안 가드의 기본 클래스
 * 공통 로직과 로깅을 제공
 */
@Injectable()
export abstract class BaseSecurityGuard implements CanActivate {
  protected abstract readonly logger: Logger;
  
  /**
   * 가드 이름 (로깅용)
   */
  protected abstract getGuardName(): string;

  /**
   * 실제 검증 로직
   */
  protected abstract validateRequest(request: Request): Promise<boolean> | boolean;

  /**
   * 검증 실패 시 상세 메시지
   */
  protected getFailureMessage(_request: Request): string {
    return `Access denied by ${this.getGuardName()}`;
  }

  /**
   * Guard 실행
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();
    const guardName = this.getGuardName();

    try {
      // 검증 수행
      const result = await this.validateRequest(request);
      
      // 실행 시간 측정
      const duration = Date.now() - startTime;
      
      // 결과 로깅
      this.logGuardExecution(request, result, duration);
      
      // 실패 시 추가 정보 저장
      if (!result) {
        this.attachFailureInfo(request, guardName);
      }
      
      return result;
    } catch (error) {
      // 에러 처리
      this.handleError(error, request);
      return false;
    }
  }

  /**
   * Guard 실행 로깅
   */
  protected logGuardExecution(
    request: Request,
    result: boolean,
    duration: number,
  ): void {
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || 'unknown';
    
    if (result) {
      this.logger.debug(
        `${this.getGuardName()} passed - ${method} ${url} - ${ip} - ${duration}ms`,
      );
    } else {
      this.logger.warn(
        `${this.getGuardName()} blocked - ${method} ${url} - ${ip} - UserAgent: ${userAgent} - ${duration}ms`,
      );
    }
  }

  /**
   * 실패 정보를 요청 객체에 첨부
   */
  protected attachFailureInfo(request: Request, guardName: string): void {
    if (!request['securityFailures']) {
      request['securityFailures'] = [];
    }
    request['securityFailures'].push({
      guard: guardName,
      timestamp: new Date().toISOString(),
      message: this.getFailureMessage(request),
    });
  }

  /**
   * 에러 처리
   */
  protected handleError(error: any, request: Request): void {
    const { method, url, ip } = request;
    this.logger.error(
      `${this.getGuardName()} error - ${method} ${url} - ${ip}: ${error.message}`,
      error.stack,
    );
  }

  /**
   * IP 주소 추출 (공통 유틸리티)
   */
  protected getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * User-Agent 추출 (공통 유틸리티)
   */
  protected getUserAgent(request: Request): string {
    return request.get('user-agent') || '';
  }

  /**
   * 요청 메타데이터 추출
   */
  protected getRequestMetadata(request: Request): {
    ip: string;
    userAgent: string;
    method: string;
    url: string;
    referer?: string;
    origin?: string;
  } {
    return {
      ip: this.getClientIp(request),
      userAgent: this.getUserAgent(request),
      method: request.method,
      url: request.url,
      referer: request.get('referer'),
      origin: request.get('origin'),
    };
  }
}
