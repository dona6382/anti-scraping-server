import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SecurityException } from '../exceptions';

interface ExceptionInfo {
  statusCode: number;
  message: string;
  error?: string | undefined;
  details?: Record<string, unknown> | undefined;
  stack?: string | undefined;
}

/**
 * 통합 예외 필터
 * 모든 예외를 처리하고 안전한 응답을 생성
 */
@Catch()
export class UnifiedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 예외 정보 추출
    const exceptionInfo = this.extractExceptionInfo(exception);
    
    // 내부 로깅 (상세 정보 포함)
    this.logException(exceptionInfo, request);

    // 클라이언트 응답 (안전한 정보만)
    const clientResponse = this.createClientResponse(exceptionInfo, request);
    
    response
      .status(exceptionInfo.statusCode)
      .json(clientResponse);
  }

  /**
   * 예외 정보 추출
   */
  private extractExceptionInfo(exception: unknown): ExceptionInfo {
    // SecurityException 처리
    if (exception instanceof SecurityException) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Access denied',
        error: 'Forbidden',
        details: {
          guardName: exception.guardName,
          reason: exception.reason,
          ip: exception.ip,
          metadata: exception.metadata
        },
        stack: exception.stack,
      };
    }

    // HttpException 처리
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();

      if (typeof response === 'object' && response !== null) {
        return {
          statusCode: status,
          message: (response as any).message || exception.message,
          error: (response as any).error || exception.name,
          details: response as Record<string, unknown>,
          stack: exception.stack,
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: exception.name,
        stack: exception.stack,
      };
    }

    // 일반 Error 처리
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isDevelopment ? exception.message : 'Internal server error',
        error: 'Internal Server Error',
        stack: exception.stack,
      };
    }

    // 알 수 없는 예외
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error',
      details: { raw: String(exception) },
    };
  }

  /**
   * 예외 로깅
   */
  private logException(
    exceptionInfo: ExceptionInfo,
    request: Request
  ): void {
    const logContext = {
      statusCode: exceptionInfo.statusCode,
      method: request.method,
      url: request.url,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    // 4xx 에러는 경고, 5xx 에러는 에러로 로깅
    if (exceptionInfo.statusCode >= 500) {
      this.logger.error(
        `${exceptionInfo.message}`,
        exceptionInfo.stack,
        {
          ...logContext,
          details: exceptionInfo.details,
        }
      );
    } else if (exceptionInfo.statusCode >= 400) {
      this.logger.warn(
        `${exceptionInfo.message}`,
        {
          ...logContext,
          details: exceptionInfo.details,
        }
      );
    }
  }

  /**
   * 클라이언트 응답 생성
   */
  private createClientResponse(
    exceptionInfo: ExceptionInfo,
    request: Request
  ): Record<string, unknown> {
    const baseResponse = {
      statusCode: exceptionInfo.statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // 프로덕션 환경에서는 최소한의 정보만 노출
    if (!this.isDevelopment) {
      if (exceptionInfo.statusCode >= 500) {
        return {
          ...baseResponse,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };
      }

      if (exceptionInfo.statusCode === 403) {
        return {
          ...baseResponse,
          message: 'Access denied',
          error: 'Forbidden',
        };
      }

      return {
        ...baseResponse,
        message: exceptionInfo.message,
        error: exceptionInfo.error || 'Error',
      };
    }

    // 개발 환경에서는 상세 정보 포함
    return {
      ...baseResponse,
      message: exceptionInfo.message,
      error: exceptionInfo.error,
      // SecurityException의 경우 공개 가능한 정보만
      ...(exceptionInfo.details && 
        !(exceptionInfo.details.guardName) && {
          details: exceptionInfo.details,
        }),
      // 스택 트레이스는 개발 환경에서만
      ...(this.isDevelopment && exceptionInfo.statusCode >= 500 && exceptionInfo.stack && {
        stack: exceptionInfo.stack.split('\n').slice(0, 5),
      }),
    };
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (ips) {
        return ips.split(',')[0]?.trim() || 'unknown';
      }
    }

    return (
      (request.headers['x-real-ip'] as string) ||
      (request as any).connection?.remoteAddress ||
      (request as any).socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}

/**
 * HTTP Exception Filter
 * HTTP 예외만 처리하는 필터 (특정 컨트롤러용)
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 
        typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message,
    };

    this.logger.warn(
      `HTTP Exception: ${errorResponse.message}`,
      {
        statusCode: status,
        path: request.url,
        method: request.method,
      }
    );

    response.status(status).json(errorResponse);
  }
}

/**
 * Validation Exception Filter
 * 검증 예외 전용 필터
 */
@Catch(HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    if (status === HttpStatus.BAD_REQUEST) {
      const exceptionResponse = exception.getResponse();
      
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        error: 'Validation Error',
        message: 'The request contains invalid data',
        // 개발 환경에서만 상세 검증 오류 표시
        ...(process.env.NODE_ENV !== 'production' && 
          typeof exceptionResponse === 'object' && 
          'errors' in exceptionResponse && {
            errors: (exceptionResponse as any).errors,
          }),
      });
    } else {
      // BAD_REQUEST가 아닌 경우 기본 처리
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message,
      });
    }
  }
}
