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
import { RequestUtils } from '../utils/request.utils';
import { SystemUtils } from '../utils/system.utils';
import { ExtendedRequest } from '../../core/types';

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

    // Challenge HTML 응답 처리 (JSON이 아닌 HTML 반환)
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        (exceptionResponse as Record<string, unknown>).type === 'CHALLENGE_REQUIRED'
      ) {
        response
          .status(exception.getStatus())
          .header('Content-Type', 'text/html')
          .header('Cache-Control', 'no-store')
          .send((exceptionResponse as Record<string, unknown>).html);
        return;
      }
    }

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
        const res = response as Record<string, unknown>;
        return {
          statusCode: status,
          message: (res.message as string) || exception.message,
          error: (res.error as string) || exception.name,
          details: res,
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
      ip: RequestUtils.hashIp(this.getClientIp(request), 'log'),
      userAgent: request.headers['user-agent'],
      timestamp: SystemUtils.timestamp(),
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
      timestamp: SystemUtils.timestamp(),
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
    return RequestUtils.extractClientIp(request as ExtendedRequest);
  }
}

