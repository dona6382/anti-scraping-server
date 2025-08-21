import { HttpException, HttpStatus } from '@nestjs/common';
import { SecurityReason } from '../../types';

/**
 * Security Exception Base Class
 * 보안 관련 예외를 처리하는 기본 클래스
 */
export class SecurityException extends HttpException {
  public readonly guardName: string;
  public readonly reason: SecurityReason;
  public readonly ip: string | undefined;
  public readonly metadata: Record<string, unknown> | undefined;

  constructor(
    guardName: string,
    reason: SecurityReason,
    ip?: string,
    metadata?: Record<string, unknown>
  ) {
    // 프로덕션 환경에서는 일반적인 메시지만 노출
    const message = process.env.NODE_ENV === 'production' 
      ? 'Access denied' 
      : `Access denied by ${guardName}: ${reason}`;

    super(message, HttpStatus.FORBIDDEN);
    
    this.guardName = guardName;
    this.reason = reason;
    this.ip = ip;
    this.metadata = metadata;
  }

  /**
   * 클라이언트에게 안전한 에러 응답 생성
   */
  getPublicError(): Record<string, unknown> {
    return {
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Access denied',
      timestamp: new Date().toISOString(),
      // 프로덕션에서는 상세 정보를 노출하지 않음
      ...(process.env.NODE_ENV !== 'production' && {
        guard: this.guardName,
        reason: this.reason,
      }),
    };
  }

  /**
   * 내부 로깅용 상세 정보
   */
  getInternalDetails(): Record<string, unknown> {
    return {
      guardName: this.guardName,
      reason: this.reason,
      ip: this.ip,
      metadata: this.metadata,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * IP Blocked Exception
 */
export class IpBlockedException extends SecurityException {
  constructor(ip: string, reason?: string | null) {
    super(
      'IpBlacklistGuard',
      'BOT_DETECTED',
      ip,
      { blockReason: reason ?? 'Unknown' }
    );
  }
}

/**
 * Rate Limit Exception
 */
export class RateLimitException extends SecurityException {
  constructor(ip: string, limit: number, ttl: number) {
    super(
      'ThrottlerGuard',
      'RATE_LIMIT_EXCEEDED',
      ip,
      { limit, ttl }
    );
  }
}

/**
 * Invalid User Agent Exception
 */
export class InvalidUserAgentException extends SecurityException {
  constructor(ip: string, userAgent: string) {
    super(
      'UserAgentGuard',
      'INVALID_USER_AGENT',
      ip,
      { userAgent: userAgent.substring(0, 100) } // 일부만 저장
    );
  }
}

/**
 * Headless Browser Exception
 */
export class HeadlessBrowserException extends SecurityException {
  constructor(ip: string, detectionFactors: string[]) {
    super(
      'HeadlessBrowserGuard',
      'HEADLESS_BROWSER_DETECTED',
      ip,
      { factors: detectionFactors }
    );
  }
}

/**
 * Honeypot Triggered Exception
 */
export class HoneypotException extends SecurityException {
  constructor(ip: string, fieldName?: string) {
    super(
      'HoneypotGuard',
      'HONEYPOT_TRIGGERED',
      ip,
      { triggeredField: fieldName ? 'hidden' : undefined } // 필드명은 노출하지 않음
    );
  }
}

/**
 * reCAPTCHA Failed Exception
 */
export class RecaptchaException extends SecurityException {
  constructor(ip: string, score?: number) {
    super(
      'RecaptchaGuard',
      'RECAPTCHA_VERIFICATION_FAILED',
      ip,
      { 
        // 점수는 로깅용으로만 저장, 클라이언트에는 노출 안 함
        ...(process.env.NODE_ENV !== 'production' && { score })
      }
    );
  }
}

/**
 * Validation Exception
 */
export class ValidationException extends HttpException {
  constructor(
    errors: Record<string, string[]>,
    message: string = 'Validation failed'
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        errors: process.env.NODE_ENV === 'production' 
          ? undefined 
          : errors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST
    );
  }
}

/**
 * Business Logic Exception
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    code?: string
  ) {
    super(
      {
        statusCode,
        message,
        code,
        timestamp: new Date().toISOString(),
      },
      statusCode
    );
  }
}

/**
 * Configuration Exception
 */
export class ConfigurationException extends HttpException {
  constructor(missingConfig: string) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Service temporarily unavailable'
      : `Missing required configuration: ${missingConfig}`;

    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/**
 * External Service Exception
 */
export class ExternalServiceException extends HttpException {
  constructor(
    service: string,
    originalError?: Error
  ) {
    const message = process.env.NODE_ENV === 'production'
      ? 'External service unavailable'
      : `External service '${service}' failed: ${originalError?.message}`;

    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        service: process.env.NODE_ENV === 'production' ? undefined : service,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
