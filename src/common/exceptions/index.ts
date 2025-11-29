/**
 * Common Exceptions Export
 * 모든 예외 클래스를 중앙에서 관리
 * 
 * 리팩토링 완료: 중복 제거 및 통합
 */

// ============================================
// 기본 애플리케이션 예외들 (메인 시스템)
// ============================================
export {
  // Base Exception
  BaseApplicationException,
  
  // Validation & Business
  ValidationException,
  BusinessLogicException,
  ResourceNotFoundException,
  
  // Security (from application.exception.ts)
  SecurityException,
  RateLimitException,
  IpBlockedException,
  BotDetectedException,
  
  // External & System
  ExternalServiceException,
  SystemException,
  DatabaseException,
} from './application.exception';

// ============================================
// 보안 전용 예외들 (추가 보안 레이어)
// ============================================
export {
  InvalidUserAgentException,
  HeadlessBrowserException,
} from './security-specific.exception';

// ============================================
// 타입 및 인터페이스
// ============================================
export type { InternalErrorDetails } from '../constants/error.constants';
