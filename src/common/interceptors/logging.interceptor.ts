import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logging Interceptor
 * 모든 요청/응답을 로깅
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '-';
    const startTime = Date.now();

    // 요청 ID 생성 (추적용)
    const requestId = this.generateRequestId();
    request.id = requestId;

    // 요청 로깅
    this.logger.log(
      `[${requestId}] ${method} ${url} - ${ip} - ${userAgent}`,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          // 응답 로깅
          this.logger.log(
            `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          
          // 에러 로깅
          this.logger.error(
            `[${requestId}] ${method} ${url} - ERROR - ${duration}ms`,
            error.message,
          );
        },
      }),
    );
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
