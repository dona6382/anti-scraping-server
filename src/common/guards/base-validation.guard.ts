import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ExtendedRequest, ValidationResult } from '../../types';
import { BaseSecurityGuard } from './base-security.guard';

/**
 * Base Validation Guard
 * 검증 로직이 있는 가드들의 공통 기능 제공
 */
@Injectable()
export abstract class BaseValidationGuard extends BaseSecurityGuard implements CanActivate {
  protected abstract override readonly logger: Logger;

  /**
   * 가드별 검증 로직 구현
   */
  protected abstract performValidation(request: ExtendedRequest): Promise<ValidationResult>;

  /**
   * 가드별 예외 생성
   */
  protected abstract createException(request: ExtendedRequest, result: ValidationResult): Error;

  /**
   * 통합된 canActivate 구현
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    try {
      // 공통 요청 메타데이터 설정
      this.enrichRequest(request);

      // 가드별 검증 수행
      const result = await this.performValidation(request);

      if (!result.isValid) {
        // 보안 위반 로깅
        this.logSecurityViolation(request, result.reason || 'Validation failed');

        // 가드별 예외 발생
        throw this.createException(request, result);
      }

      // 성공 로깅 (디버그 모드)
      if (process.env.LOG_LEVEL === 'debug') {
        this.logRequest(request, `Passed ${this.getGuardName()} validation`);
      }

      return true;
    } catch (error) {
      // 우리가 만든 예외는 그대로 전달
      if (this.isSecurityException(error)) {
        throw error;
      }

      // 예상치 못한 에러 처리
      this.handleUnexpectedError(error as Error, request);
      
      // fail-open 또는 fail-closed 결정
      return this.shouldFailOpen();
    }
  }

  /**
   * 요청에 메타데이터 추가
   */
  protected enrichRequest(request: ExtendedRequest): void {
    if (!request.requestId) {
      request.requestId = this.generateRequestId();
    }

    if (!request.timestamp) {
      request.timestamp = Date.now();
    }

    // 보안 컨텍스트 초기화
    if (!request.securityContext) {
      request.securityContext = {
        ip: this.getClientIp(request),
        userAgent: this.getUserAgent(request),
        timestamp: Date.now(),
        requestId: request.requestId,
        flags: {},
      };
    }
  }

  /**
   * 보안 예외인지 확인
   */
  protected isSecurityException(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    // SecurityException 또는 그 하위 클래스인지 확인
    return 'guardName' in error && 'reason' in error;
  }

  /**
   * 예상치 못한 에러 처리
   */
  protected handleUnexpectedError(error: Error, request: ExtendedRequest): void {
    this.logger.error(
      `Unexpected error in ${this.getGuardName()}:`,
      {
        error: error.message,
        stack: error.stack,
        request: {
          method: request.method,
          url: request.url,
          ip: this.getClientIp(request),
        },
      }
    );
  }

  /**
   * fail-open 정책 결정
   */
  protected shouldFailOpen(): boolean {
    // 프로덕션에서는 기본적으로 fail-open
    // 개발/테스트에서는 fail-closed
    return process.env.NODE_ENV === 'production' && 
           process.env.SECURITY_STRICT_MODE !== 'true';
  }

  /**
   * BaseSecurityGuard의 추상 메서드 구현
   */
  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const result = await this.performValidation(request);
    return result.isValid;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    return 'Access denied';
  }
}
