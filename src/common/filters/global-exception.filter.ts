import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Domain Exception
 * 도메인 레이어에서 발생하는 비즈니스 로직 예외
 */
export class DomainException extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number = HttpStatus.BAD_REQUEST,
    public readonly context?: any,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

/**
 * Unified Exception Filter
 * 모든 예외를 처리하고 일관된 응답 형식을 제공
 */
@Catch()
export class UnifiedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnifiedExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 에러 정보 추출
    const errorInfo = this.extractErrorInfo(exception);
    
    // 로깅
    this.logError(exception, errorInfo, request);

    // 응답 생성
    const errorResponse = this.createErrorResponse(errorInfo, request);
    
    // 응답 전송
    response.status(errorInfo.statusCode).json(errorResponse);
  }

  /**
   * 예외로부터 에러 정보 추출
   */
  private extractErrorInfo(exception: unknown): {
    statusCode: number;
    message: string;
    code: string;
    details?: any;
  } {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    // Domain Exception 처리
    if (exception instanceof DomainException) {
      statusCode = exception.statusCode;
      message = exception.message;
      code = exception.code;
      details = exception.context;
    }
    // HTTP Exception 처리
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const errorResponse = exception.getResponse();
      
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        message = (errorResponse as any).message || message;
        code = (errorResponse as any).error || code;
        details = (errorResponse as any).details;
      }
    }
    // 일반 Error 처리
    else if (exception instanceof Error) {
      message = exception.message;
      
      // 개발 환경에서는 스택 트레이스 포함
      if (this.isDevelopment) {
        details = {
          stack: exception.stack,
          name: exception.name,
        };
      }
    }

    // 프로덕션 환경에서 내부 에러 숨기기
    if (!this.isDevelopment && statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'An error occurred processing your request';
      details = undefined;
    }

    return { statusCode, message, code, details };
  }

  /**
   * 에러 로깅
   */
  private logError(
    exception: unknown,
    errorInfo: any,
    request: Request,
  ): void {
    const logContext = {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      statusCode: errorInfo.statusCode,
      code: errorInfo.code,
    };

    // 에러 레벨에 따른 로깅
    if (errorInfo.statusCode >= 500) {
      this.logger.error(
        `Unhandled exception: ${errorInfo.message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    } else if (errorInfo.statusCode >= 400) {
      this.logger.warn(
        `Client error: ${errorInfo.code} - ${errorInfo.message}`,
        logContext,
      );
    }
  }

  /**
   * 에러 응답 생성
   */
  private createErrorResponse(
    errorInfo: any,
    request: Request,
  ): any {
    const response: any = {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
        statusCode: errorInfo.statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };

    // 상세 정보가 있으면 추가
    if (errorInfo.details) {
      response.error.details = errorInfo.details;
    }

    // Request ID가 있으면 추가 (추적용)
    if ((request as any).id) {
      response.requestId = (request as any).id;
    }

    return response;
  }
}

/**
 * Security Exception
 * 보안 관련 예외
 */
export class SecurityException extends DomainException {
  constructor(
    message: string,
    code: string = 'SECURITY_VIOLATION',
    context?: any,
  ) {
    super(message, code, HttpStatus.FORBIDDEN, context);
    this.name = 'SecurityException';
  }
}

/**
 * Validation Exception
 * 입력 검증 예외
 */
export class ValidationException extends DomainException {
  constructor(
    message: string,
    code: string = 'VALIDATION_ERROR',
    context?: any,
  ) {
    super(message, code, HttpStatus.BAD_REQUEST, context);
    this.name = 'ValidationException';
  }
}

/**
 * Not Found Exception
 * 리소스를 찾을 수 없음
 */
export class ResourceNotFoundException extends DomainException {
  constructor(
    message: string,
    code: string = 'RESOURCE_NOT_FOUND',
    context?: any,
  ) {
    super(message, code, HttpStatus.NOT_FOUND, context);
    this.name = 'ResourceNotFoundException';
  }
}

/**
 * Rate Limit Exception
 * 요청 제한 초과
 */
export class RateLimitException extends DomainException {
  constructor(
    message: string = 'Too many requests',
    code: string = 'RATE_LIMIT_EXCEEDED',
    context?: any,
  ) {
    super(message, code, HttpStatus.TOO_MANY_REQUESTS, context);
    this.name = 'RateLimitException';
  }
}
