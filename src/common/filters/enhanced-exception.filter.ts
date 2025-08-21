import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RequestUtils } from '../utils/request.utils';
import { 
  BaseApplicationException,
  SystemException,
} from '../exceptions/application.exception';
import { 
  ErrorResponseMode, 
  ErrorCodes,
  StandardErrorResponse,
} from '../constants/error.constants';

/**
 * Enhanced Global Exception Filter
 * 모든 예외를 처리하고 보안을 고려한 응답 생성
 */
@Catch()
export class EnhancedGlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionHandler');
  private readonly responseMode: ErrorResponseMode;
  private readonly shouldLogDetails: boolean;
  private readonly sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'email',
    'phone',
  ];

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get('NODE_ENV', 'production');
    
    // 환경에 따른 응답 모드 설정
    this.responseMode = this.getResponseMode(env);
    this.shouldLogDetails = env !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 에러 정보 추출 및 정제
    const { statusCode, errorResponse, logData } = this.processException(
      exception,
      request
    );

    // 내부 로깅 (민감한 정보 포함 가능)
    this.logException(logData, request);

    // 클라이언트 응답 (안전한 정보만)
    response.status(statusCode).json(errorResponse);

    // 메트릭 수집
    this.collectMetrics(exception, request);
  }

  /**
   * 예외 처리 및 응답 생성
   */
  private processException(
    exception: unknown,
    request: Request
  ): {
    statusCode: number;
    errorResponse: StandardErrorResponse;
    logData: any;
  } {
    // BaseApplicationException 처리
    if (exception instanceof BaseApplicationException) {
      return {
        statusCode: exception.getStatus(),
        errorResponse: this.createStandardResponse(
          exception.errorCode,
          exception.message,
          exception.getStatus(),
          request,
          this.responseMode === ErrorResponseMode.DEVELOPMENT ? exception.stack : undefined
        ),
        logData: {
          type: 'ApplicationException',
          exception: exception.getResponse(this.responseMode),
        },
      };
    }

    // HttpException 처리
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      
      return {
        statusCode: status,
        errorResponse: this.createStandardResponse(
          this.getErrorCode(status),
          this.extractMessage(response),
          status,
          request
        ),
        logData: {
          type: 'HttpException',
          status,
          response: this.sanitizeData(response),
        },
      };
    }

    // 일반 Error 처리
    if (exception instanceof Error) {
      // 시스템 예외로 변환
      const systemException = new SystemException(
        undefined,
        exception
      );

      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorResponse: this.createStandardResponse(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'An unexpected error occurred',
          HttpStatus.INTERNAL_SERVER_ERROR,
          request
        ),
        logData: {
          type: 'UnhandledError',
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        },
      };
    }

    // 알 수 없는 예외
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: this.createStandardResponse(
        ErrorCodes.UNKNOWN_ERROR,
        'An unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
        request
      ),
      logData: {
        type: 'UnknownException',
        exception: String(exception),
      },
    };
  }

  /**
   * 표준 응답 생성
   */
  private createStandardResponse(
    errorCode: string,
    message: string,
    statusCode: number,
    request: Request,
    stack?: string
  ): StandardErrorResponse {
    const response: StandardErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: this.sanitizeMessage(message),
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        requestId: (request as any).requestId,
      },
    };

    // 개발 환경에서만 스택 트레이스 포함
    if (this.responseMode === ErrorResponseMode.DEVELOPMENT && stack) {
      response.error.stack = stack.split('\n').slice(0, 5);
    }

    return response;
  }

  /**
   * 에러 로깅
   */
  private logException(logData: any, request: Request): void {
    const logContext = {
      ...logData,
      request: {
        method: request.method,
        url: request.url,
        ip: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        requestId: (request as any).requestId,
        timestamp: new Date().toISOString(),
      },
    };

    // 민감한 정보 제거
    const sanitizedContext = this.sanitizeData(logContext);

    // 로그 레벨 결정
    const statusCode = logData.status || 500;
    
    if (statusCode >= 500) {
      this.logger.error('Server Error', sanitizedContext);
    } else if (statusCode >= 400) {
      this.logger.warn('Client Error', sanitizedContext);
    } else {
      this.logger.log('Exception', sanitizedContext);
    }
  }

  /**
   * 메트릭 수집
   */
  private collectMetrics(exception: unknown, request: Request): void {
    // TODO: Prometheus, DataDog 등 메트릭 시스템 연동
    const metric = {
      type: exception?.constructor?.name || 'Unknown',
      path: request.url,
      method: request.method,
      timestamp: Date.now(),
    };

    // 메트릭 전송 (비동기)
    setImmediate(() => {
      this.sendMetrics(metric);
    });
  }

  /**
   * 메트릭 전송
   */
  private sendMetrics(metric: any): void {
    // 메트릭 시스템으로 전송
    if (this.shouldLogDetails) {
      this.logger.debug('Metric collected', metric);
    }
  }

  /**
   * 민감한 데이터 제거
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      // 민감한 필드명 확인
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        // 재귀적으로 처리
        sanitized[key] = this.sanitizeData(sanitized[key]);
      } else if (typeof sanitized[key] === 'string') {
        // 민감한 패턴 확인
        sanitized[key] = this.sanitizeString(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * 민감한 필드 확인
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.sensitiveFields.some(field => 
      lowerFieldName.includes(field)
    );
  }

  /**
   * 문자열 민감 정보 제거
   */
  private sanitizeString(value: string): string {
    // JWT 토큰 패턴
    if (/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) {
      return 'Bearer [JWT_REDACTED]';
    }

    // API 키 패턴
    if (/^[a-zA-Z0-9]{32,}$/.test(value) && value.length > 30) {
      return '[API_KEY_REDACTED]';
    }

    // 이메일 마스킹
    if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)) {
      const [local, domain] = value.split('@');
      return local ? `${local.substring(0, 2)}***@${domain}` : value;
    }

    // 신용카드 번호 패턴
    if (/^\d{13,19}$/.test(value)) {
      return '[CARD_NUMBER_REDACTED]';
    }

    return value;
  }

  /**
   * 메시지 정제
   */
  private sanitizeMessage(message: string): string {
    // SQL 인젝션 패턴 제거
    message = message.replace(/SELECT.*FROM/gi, '[SQL_REMOVED]');
    
    // 파일 경로 제거
    message = message.replace(/\/[\w\/]+\.(js|ts|json)/g, '[PATH_REMOVED]');
    
    // 스택 트레이스 제거
    message = message.replace(/at\s+.+\(.+:\d+:\d+\)/g, '[STACK_REMOVED]');

    return message;
  }

  /**
   * 응답 모드 결정
   */
  private getResponseMode(env: string): ErrorResponseMode {
    switch (env.toLowerCase()) {
      case 'development':
      case 'dev':
        return ErrorResponseMode.DEVELOPMENT;
      case 'staging':
      case 'stage':
        return ErrorResponseMode.STAGING;
      default:
        return ErrorResponseMode.PRODUCTION;
    }
  }

  /**
   * HTTP 상태 코드로 에러 코드 결정
   */
  private getErrorCode(status: number): string {
    switch (status) {
      case 400: return ErrorCodes.VALIDATION_FAILED;
      case 401: return ErrorCodes.AUTHENTICATION_FAILED;
      case 403: return ErrorCodes.AUTHORIZATION_FAILED;
      case 404: return ErrorCodes.RESOURCE_NOT_FOUND;
      case 429: return ErrorCodes.RATE_LIMIT_EXCEEDED;
      case 500: return ErrorCodes.INTERNAL_SERVER_ERROR;
      case 503: return ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE;
      default: return ErrorCodes.UNKNOWN_ERROR;
    }
  }

  /**
   * 응답에서 메시지 추출
   */
  private extractMessage(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.message) {
      return Array.isArray(response.message) 
        ? response.message[0] 
        : response.message;
    }

    return 'An error occurred';
  }

  /**
   * 클라이언트 IP 추출 (RequestUtils 사용)
   */
  private getClientIp(request: Request): string {
    return RequestUtils.extractClientIp(request);
  }
}
