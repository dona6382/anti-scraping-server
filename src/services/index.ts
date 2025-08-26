/**
 * Business Services Index
 * 정리된 비즈니스 서비스들만 export
 */

// 실제로 존재하는 서비스들만 export
export { BusinessService } from './business.service';

// 타입들은 각 feature 모듈에서 직접 정의
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface BlacklistRequest {
  ip: string;
  reason?: string;
  ttl?: number;
}