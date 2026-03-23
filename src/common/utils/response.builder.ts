import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '../../core/types';

/**
 * Response Builder Utility
 * API 응답을 일관되게 생성하는 유틸리티
 */
export class ResponseBuilder {
  /**
   * 성공 응답 생성
   */
  static success<T>(
    data: T,
    message: string = 'Success',
    metadata?: Record<string, unknown>
  ): ApiResponse<T> {
    return {
      status: 'success',
      data,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
  }

  /**
   * 에러 응답 생성
   */
  static error(
    message: string,
    code?: string,
    details?: unknown
  ): ApiResponse<null> {
    return {
      status: 'error',
      message,
      ...(code && { code }),
      details: process.env.NODE_ENV === 'production' ? undefined : details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 페이지네이션 응답 생성
   */
  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): ApiResponse<T[]> & { pagination: any } {
    const totalPages = Math.ceil(total / limit);
    
    return {
      status: 'success',
      data,
      message: message || `Retrieved ${data.length} items`,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 빈 성공 응답 (204 No Content용)
   */
  static noContent(): { message: string; timestamp: string } {
    return {
      message: 'Operation completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 상태 체크 응답
   */
  static health(
    status: 'healthy' | 'unhealthy' | 'degraded',
    services?: Record<string, any>
  ): Record<string, unknown> {
    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...(services && { services }),
    };
  }

  /**
   * 검증 에러 응답
   */
  static validationError(
    errors: Record<string, string[]>,
    message: string = 'Validation failed'
  ): ApiResponse<null> {
    return {
      status: 'error',
      message,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'production' 
        ? undefined 
        : { validationErrors: errors },
    };
  }

  /**
   * Rate Limit 응답
   */
  static rateLimited(
    retryAfter: number,
    limit?: number,
    remaining?: number
  ): ApiResponse<null> {
    return {
      status: 'error',
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      details: {
        retryAfter,
        ...(limit !== undefined && { limit }),
        ...(remaining !== undefined && { remaining }),
      },
    };
  }

  /**
   * 권한 없음 응답
   */
  static unauthorized(reason?: string): ApiResponse<null> {
    return {
      status: 'error',
      message: reason || 'Unauthorized',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 접근 거부 응답
   */
  static forbidden(reason?: string): ApiResponse<null> {
    return {
      status: 'error',
      message: reason || 'Access denied',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 리소스 없음 응답
   */
  static notFound(resource?: string): ApiResponse<null> {
    return {
      status: 'error',
      message: resource ? `${resource} not found` : 'Resource not found',
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 서비스 이용 불가 응답
   */
  static serviceUnavailable(service?: string): ApiResponse<null> {
    return {
      status: 'error',
      message: service 
        ? `${service} is temporarily unavailable` 
        : 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 커스텀 응답 생성
   */
  static custom<T>(
    statusCode: HttpStatus,
    data?: T,
    message?: string,
    metadata?: Record<string, unknown>
  ): ApiResponse<T | null> {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    
    if (isSuccess && data !== undefined) {
      return {
        status: 'success',
        data,
        message: message || 'Success',
        timestamp: new Date().toISOString(),
        ...metadata,
      };
    }
    
    return {
      status: 'error',
      data: undefined,
      message: message || 'Error',
      timestamp: new Date().toISOString(),
      ...metadata,
    };
  }
}

/**
 * Response Decorator
 * 메서드 응답을 자동으로 포맷팅하는 데코레이터
 */
export function FormatResponse(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args);
        
        // 이미 포맷된 응답인 경우 그대로 반환
        if (result && typeof result === 'object' && 'status' in result) {
          return result;
        }
        
        // 새로운 포맷 적용
        return ResponseBuilder.success(result, message);
      } catch (error) {
        throw error; // 에러는 Exception Filter에서 처리
      }
    };

    return descriptor;
  };
}
