import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response Structure
 */
export interface Response<T> {
  success: boolean;
  data: T;
  timestamp: string;
  requestId?: string;
}

/**
 * Transform Interceptor
 * 모든 응답을 일관된 형식으로 변환
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.id;

    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        ...(requestId && { requestId }),
      })),
    );
  }
}
