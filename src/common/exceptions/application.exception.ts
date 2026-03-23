import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorCodes, 
  UserFriendlyMessages,
  InternalErrorDetails,
  ErrorResponseMode,
} from '../constants/error.constants';

/**
 * Base Application Exception
 * 모든 애플리케이션 예외의 기본 클래스
 */
export abstract class BaseApplicationException extends HttpException {
  public readonly errorCode: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly internalDetails?: InternalErrorDetails;
  
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    errorCode: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    httpStatus: HttpStatus,
    internalDetails?: InternalErrorDetails,
    customMessage?: string
  ) {
    // 사용자에게 노출할 안전한 메시지
    const userMessage = customMessage || UserFriendlyMessages[errorCode] || 'An error occurred';
    
    super(userMessage, httpStatus);
    
    this.errorCode = errorCode;
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date();
    // undefined 체크를 통해 안전하게 할당
    if (internalDetails !== undefined) {
      this.internalDetails = internalDetails;
    }
    
    // 내부 로깅
    this.logError();
  }

  /**
   * 환경에 따른 응답 생성
   */
  public override getResponse(mode: ErrorResponseMode = ErrorResponseMode.PRODUCTION): Record<string, any> {
    const baseResponse = {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
      },
    };

    // 개발 환경에서만 상세 정보 추가
    if (mode === ErrorResponseMode.DEVELOPMENT) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          category: this.category,
          severity: this.severity,
          details: this.internalDetails?.context,
          stack: this.stack?.split('\n').slice(0, 10),
        },
      };
    }

    // Staging 환경에서는 제한된 정보
    if (mode === ErrorResponseMode.STAGING) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          category: this.category,
        },
      };
    }

    // Production 환경에서는 최소 정보
    return baseResponse;
  }

  /**
   * 에러 로깅
   */
  private logError(): void {
    const logData = {
      errorCode: this.errorCode,
      category: this.category,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      ...this.internalDetails,
    };

    // 심각도에 따른 로그 레벨 결정
    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error('CRITICAL ERROR', logData);
        // 알림 시스템 트리거 (예: Slack, Email)
        this.sendAlert(logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error('HIGH SEVERITY ERROR', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('MEDIUM SEVERITY ERROR', logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.log('LOW SEVERITY ERROR', logData);
        break;
    }
  }

  /**
   * 심각한 에러 알림
   */
  private sendAlert(data: any): void {
    // TODO: 알림 시스템 구현 (Slack, Email, SMS 등)
    this.logger.error('🚨 ALERT: Critical error occurred', data);
  }
}

/**
 * Validation Exception
 */
export class ValidationException extends BaseApplicationException {
  constructor(
    message?: string,
    validationErrors?: Record<string, string[]>,
    context?: Record<string, unknown>
  ) {
    super(
      ErrorCodes.VALIDATION_FAILED,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      HttpStatus.BAD_REQUEST,
      {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        context: { validationErrors, ...context },
      },
      message
    );
  }
}

/**
 * Security Exception
 */
export class SecurityException extends BaseApplicationException {
  public guardName?: string;
  public reason?: string;
  public ip?: string;
  public metadata?: Record<string, any>;

  constructor(
    errorCode: string = ErrorCodes.SECURITY_VIOLATION,
    message?: string,
    context?: Record<string, unknown>,
    guardName?: string,
    reason?: string,
    ip?: string,
    metadata?: Record<string, any>
  ) {
    super(
      errorCode,
      ErrorCategory.SECURITY,
      ErrorSeverity.HIGH,
      HttpStatus.FORBIDDEN,
      {
        category: ErrorCategory.SECURITY,
        severity: ErrorSeverity.HIGH,
        context: { ...context, guardName, reason, ip, metadata },
      },
      message
    );
    
    this.guardName = guardName;
    this.reason = reason;
    this.ip = ip;
    this.metadata = metadata;
  }
}

/**
 * Rate Limit Exception
 */
export class RateLimitException extends SecurityException {
  constructor(
    retryAfter: number,
    limit?: number,
    context?: Record<string, unknown>
  ) {
    super(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      undefined,
      {
        retryAfter,
        limit,
        ...context,
      }
    );
  }
}

/**
 * IP Blocked Exception
 */
export class IpBlockedException extends SecurityException {
  constructor(ip: string, reason?: string) {
    super(
      ErrorCodes.IP_BLOCKED,
      undefined,
      {
        // IP는 로깅용으로만 저장, 클라이언트에는 노출하지 않음
        ip,
        reason,
      }
    );
  }
}

/**
 * Bot Detected Exception
 */
export class BotDetectedException extends SecurityException {
  constructor(detectionMethod: string, confidence: number) {
    super(
      ErrorCodes.BOT_DETECTED,
      undefined,
      {
        // 탐지 방법은 로깅용으로만 저장
        detectionMethod,
        confidence,
      }
    );
  }
}

/**
 * Business Logic Exception
 */
export class BusinessLogicException extends BaseApplicationException {
  constructor(
    message?: string,
    errorCode: string = ErrorCodes.BUSINESS_RULE_VIOLATION,
    context?: Record<string, unknown>
  ) {
    super(
      errorCode,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        category: ErrorCategory.BUSINESS_LOGIC,
        severity: ErrorSeverity.MEDIUM,
        context: context || {},
      },
      message
    );
  }
}

/**
 * Resource Not Found Exception
 */
export class ResourceNotFoundException extends BusinessLogicException {
  constructor(resource: string, identifier?: string | number) {
    super(
      `${resource} not found`,
      ErrorCodes.RESOURCE_NOT_FOUND,
      {
        resource,
        // ID는 로깅용으로만 저장
        identifier,
      }
    );
  }
}

/**
 * External Service Exception
 */
export class ExternalServiceException extends BaseApplicationException {
  constructor(
    serviceName: string,
    originalError?: Error,
    timeout?: boolean
  ) {
    const errorCode = timeout 
      ? ErrorCodes.EXTERNAL_SERVICE_TIMEOUT 
      : ErrorCodes.EXTERNAL_SERVICE_ERROR;

    super(
      errorCode,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorSeverity.HIGH,
      HttpStatus.SERVICE_UNAVAILABLE,
      originalError ? {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.HIGH,
        originalError: originalError,
        context: {
          serviceName,
          timeout: timeout || false,
        },
      } : {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.HIGH,
        context: {
          serviceName,
          timeout: timeout || false,
        },
      }
    );
  }
}

/**
 * System Exception
 */
export class SystemException extends BaseApplicationException {
  constructor(
    message?: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      HttpStatus.INTERNAL_SERVER_ERROR,
      originalError ? {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        originalError: originalError,
        context: context || {},
      } : {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        context: context || {},
      },
      message
    );
  }
}

/**
 * Database Exception
 */
export class DatabaseException extends SystemException {
  constructor(operation: string, originalError?: Error) {
    super(
      'Database operation failed',
      originalError,
      {
        operation,
      }
    );
  }
}

/**
 * Invalid User Agent Exception
 * User-Agent 검증 실패 시 발생
 */
export class InvalidUserAgentException extends SecurityException {
  constructor(userAgent: string) {
    super(
      ErrorCodes.INVALID_USER_AGENT,
      process.env.NODE_ENV === 'production'
        ? undefined
        : `Invalid User-Agent detected: ${userAgent.substring(0, 100)}`,
      { userAgent: userAgent.substring(0, 200) },
    );
  }
}

/**
 * Headless Browser Exception
 * 헤드리스 브라우저 감지 시 발생
 */
export class HeadlessBrowserException extends SecurityException {
  constructor(detectionFactors: string[]) {
    super(
      ErrorCodes.HEADLESS_BROWSER_DETECTED,
      process.env.NODE_ENV === 'production'
        ? undefined
        : `Headless browser detected with ${detectionFactors.length} factors`,
      { factors: detectionFactors },
    );
  }
}
