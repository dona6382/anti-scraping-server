import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 응답 변환 인터페이스
 */
export interface TransformedResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
}

/**
 * Transform Interceptor
 * 모든 성공 응답을 일관된 형식으로 변환
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformedResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const { url, method, id: requestId } = request;

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: url,
        method,
        ...(requestId && { requestId }),
      })),
    );
  }
}
