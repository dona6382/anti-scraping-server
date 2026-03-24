import { ApiResponse } from '../../core/types';
import { SystemUtils } from './system.utils';
import { PaginationUtils, PaginationMeta } from './pagination.utils';

/**
 * Response Builder
 * 모든 API 응답의 단일 생성 지점
 */
export class ResponseBuilder {
  static success<T>(data: T, message = 'Success'): ApiResponse<T> {
    return {
      status: 'success',
      data,
      message,
      timestamp: SystemUtils.timestamp(),
    };
  }

  static error(message: string, code?: string, details?: unknown): ApiResponse<null> {
    return {
      status: 'error',
      message,
      ...(code && { code }),
      details: process.env.NODE_ENV === 'production' ? undefined : details,
      timestamp: SystemUtils.timestamp(),
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): ApiResponse<T[]> & { pagination: PaginationMeta } {
    return {
      status: 'success',
      data,
      message: `Retrieved ${data.length} items`,
      timestamp: SystemUtils.timestamp(),
      pagination: PaginationUtils.meta(page, limit, total),
    };
  }
}
