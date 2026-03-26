import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  ErrorCategory,
  ErrorSeverity,
  ErrorCodes,
  UserFriendlyMessages,
  InternalErrorDetails,
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

}

/**
 * Security Exception
 */
export class SecurityException extends BaseApplicationException {
  public guardName?: string;
  public reason?: string;
  public ip?: string;
  public metadata?: Record<string, unknown>;

  constructor(
    errorCode: string = ErrorCodes.SECURITY_VIOLATION,
    message?: string,
    context?: Record<string, unknown>,
    guardName?: string,
    reason?: string,
    ip?: string,
    metadata?: Record<string, unknown>
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
