import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ExtendedRequest } from '../../types';
// import { extractClientIp } from '../utils/security.utils'; // 순환 참조 방지

/**
 * Security Context Interceptor
 * 모든 요청에 보안 컨텍스트를 추가
 */
@Injectable()
export class SecurityContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityContextInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const startTime = Date.now();

    // 요청에 보안 컨텍스트 추가
    this.enrichRequest(request);

    // 요청 로깅
    this.logRequest(request);

    return next.handle().pipe(
      tap({
        next: () => {
          // 성공 응답 로깅
          const duration = Date.now() - startTime;
          this.logResponse(request, duration, 'success');
        },
        error: (error) => {
          // 에러 응답 로깅
          const duration = Date.now() - startTime;
          this.logResponse(request, duration, 'error', error);
        },
      }),
    );
  }

  /**
   * 요청에 보안 컨텍스트 추가
   */
  private enrichRequest(request: ExtendedRequest): void {
    // Request ID 생성
    if (!request.requestId) {
      request.requestId = this.generateRequestId();
    }

    // Timestamp 추가
    if (!request.timestamp) {
      request.timestamp = Date.now();
    }

    // Client Info 추가
    if (!request.clientInfo) {
      const ip = this.getClientIp(request);
      const userAgent = this.getUserAgent(request);
      
      request.clientInfo = {
        ip,
        userAgent,
        acceptLanguage: this.getHeader(request, 'accept-language'),
        acceptEncoding: this.getHeader(request, 'accept-encoding'),
        host: this.getHeader(request, 'host'),
        origin: this.getHeader(request, 'origin'),
        referer: this.getHeader(request, 'referer'),
      };
    }

    // Security Context 초기화
    if (!request.securityContext && request.clientInfo) {
      request.securityContext = {
        ip: request.clientInfo.ip,
        userAgent: request.clientInfo.userAgent,
        timestamp: request.timestamp || Date.now(),
        requestId: request.requestId || this.generateRequestId(),
        flags: {},
      };
    }
  }

  /**
   * 요청 로깅
   */
  private logRequest(request: ExtendedRequest): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.logger.debug(`[${request.requestId}] ${request.method} ${request.url}`, {
        ip: request.clientInfo?.ip,
        userAgent: request.clientInfo?.userAgent?.substring(0, 50),
      });
    }
  }

  /**
   * 응답 로깅
   */
  private logResponse(
    request: ExtendedRequest,
    duration: number,
    status: 'success' | 'error',
    error?: any
  ): void {
    if (process.env.LOG_LEVEL === 'debug') {
      const message = `[${request.requestId}] ${request.method} ${request.url} - ${duration}ms`;
      
      if (status === 'success') {
        this.logger.debug(`✓ ${message}`);
      } else {
        this.logger.warn(`✗ ${message}`, { error: error?.message });
      }
    }
  }

  /**
   * Request ID 생성
   */
  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIp(request: ExtendedRequest): string {
    // X-Forwarded-For 헤더 확인
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (ips) {
        return ips.split(',')[0]?.trim() || 'unknown';
      }
    }

    // 다른 프록시 헤더들 확인
    const proxyHeaders = ['x-real-ip', 'x-client-ip', 'cf-connecting-ip'];
    for (const header of proxyHeaders) {
      const value = request.headers[header];
      if (value) {
        const headerValue = Array.isArray(value) ? value[0] : value;
        if (headerValue) {
          return headerValue;
        }
      }
    }

    return request.ip || 'unknown';
  }

  /**
   * User-Agent 추출
   */
  private getUserAgent(request: ExtendedRequest): string {
    const userAgent = request.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] || '' : userAgent || '';
  }

  /**
   * 헤더 값 추출
   */
  private getHeader(request: ExtendedRequest, headerName: string): string | undefined {
    const header = request.headers[headerName.toLowerCase()];
    return Array.isArray(header) ? header[0] : header;
  }
}

/**
 * Request Metrics Interceptor
 * 요청 메트릭을 수집
 */
@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestMetricsInterceptor.name);
  private readonly metrics = new Map<string, number>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const startTime = Date.now();
    const endpoint = `${request.method}:${request.route?.path || request.url}`;

    // 요청 카운트 증가
    this.incrementMetric(`requests.${endpoint}.total`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          
          // 성공 메트릭
          this.incrementMetric(`requests.${endpoint}.success`);
          this.recordDuration(`requests.${endpoint}.duration`, duration);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          
          // 에러 메트릭
          this.incrementMetric(`requests.${endpoint}.error`);
          this.recordDuration(`requests.${endpoint}.duration`, duration);
          
          // 에러 타입별 메트릭
          const errorType = error.constructor.name;
          this.incrementMetric(`errors.${errorType}`);
        },
      }),
    );
  }

  /**
   * 메트릭 증가
   */
  private incrementMetric(key: string): void {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }

  /**
   * 응답 시간 기록
   */
  private recordDuration(key: string, duration: number): void {
    // 간단한 평균 계산 (실제로는 히스토그램 사용 권장)
    const countKey = `${key}.count`;
    const sumKey = `${key}.sum`;
    
    const count = (this.metrics.get(countKey) || 0) + 1;
    const sum = (this.metrics.get(sumKey) || 0) + duration;
    
    this.metrics.set(countKey, count);
    this.metrics.set(sumKey, sum);
    this.metrics.set(`${key}.avg`, sum / count);
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * 메트릭 초기화
   */
  resetMetrics(): void {
    this.metrics.clear();
  }
}
