/**
 * Error Response Strategy
 * 환경별 에러 응답 전략 정의
 */

export enum ErrorResponseMode {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * Error Category
 * 에러 분류 체계
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
}

/**
 * Error Severity
 * 에러 심각도
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Standardized Error Response
 * 표준화된 에러 응답 형식
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    path?: string;
    method?: string;
    requestId?: string;
    // 개발 환경에서만 노출
    details?: unknown;
    stack?: string[];
  };
}

/**
 * Internal Error Details
 * 내부 로깅용 상세 정보
 */
export interface InternalErrorDetails {
  category: ErrorCategory;
  severity: ErrorSeverity;
  originalError?: Error;
  context?: Record<string, unknown>;
  userIp?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error Code Map
 * 표준화된 에러 코드
 */
export const ErrorCodes = {
  // Validation Errors (4000-4099)
  VALIDATION_FAILED: 'ERR_4000',
  INVALID_INPUT: 'ERR_4001',
  MISSING_REQUIRED_FIELD: 'ERR_4002',
  INVALID_FORMAT: 'ERR_4003',
  
  // Authentication Errors (4100-4199)
  AUTHENTICATION_FAILED: 'ERR_4100',
  INVALID_CREDENTIALS: 'ERR_4101',
  TOKEN_EXPIRED: 'ERR_4102',
  TOKEN_INVALID: 'ERR_4103',
  
  // Authorization Errors (4200-4299)
  AUTHORIZATION_FAILED: 'ERR_4200',
  ACCESS_DENIED: 'ERR_4201',
  INSUFFICIENT_PERMISSIONS: 'ERR_4202',
  RESOURCE_FORBIDDEN: 'ERR_4203',
  
  // Security Errors (4300-4399)
  SECURITY_VIOLATION: 'ERR_4300',
  IP_BLOCKED: 'ERR_4301',
  RATE_LIMIT_EXCEEDED: 'ERR_4302',
  SUSPICIOUS_ACTIVITY: 'ERR_4303',
  BOT_DETECTED: 'ERR_4304',
  
  // Business Logic Errors (4400-4499)
  BUSINESS_RULE_VIOLATION: 'ERR_4400',
  INVALID_OPERATION: 'ERR_4401',
  RESOURCE_NOT_FOUND: 'ERR_4404',
  RESOURCE_ALREADY_EXISTS: 'ERR_4409',
  
  // External Service Errors (5000-5099)
  EXTERNAL_SERVICE_ERROR: 'ERR_5000',
  EXTERNAL_SERVICE_TIMEOUT: 'ERR_5001',
  EXTERNAL_SERVICE_UNAVAILABLE: 'ERR_5002',
  
  // System Errors (5100-5199)
  INTERNAL_SERVER_ERROR: 'ERR_5100',
  DATABASE_ERROR: 'ERR_5101',
  CACHE_ERROR: 'ERR_5102',
  FILE_SYSTEM_ERROR: 'ERR_5103',
  
  // Unknown Error
  UNKNOWN_ERROR: 'ERR_9999',
} as const;

/**
 * User-Friendly Error Messages
 * 사용자 친화적 에러 메시지 (보안 정보 제외)
 */
export const UserFriendlyMessages: Record<string, string> = {
  [ErrorCodes.VALIDATION_FAILED]: 'The provided data is invalid. Please check your input.',
  [ErrorCodes.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Required information is missing.',
  [ErrorCodes.INVALID_FORMAT]: 'The data format is incorrect.',
  
  [ErrorCodes.AUTHENTICATION_FAILED]: 'Authentication failed. Please try again.',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid credentials provided.',
  [ErrorCodes.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCodes.TOKEN_INVALID]: 'Invalid authentication token.',
  
  [ErrorCodes.AUTHORIZATION_FAILED]: 'You are not authorized to perform this action.',
  [ErrorCodes.ACCESS_DENIED]: 'Access denied.',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions.',
  [ErrorCodes.RESOURCE_FORBIDDEN]: 'Access to this resource is forbidden.',
  
  [ErrorCodes.SECURITY_VIOLATION]: 'Security check failed.',
  [ErrorCodes.IP_BLOCKED]: 'Access denied from your location.',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
  [ErrorCodes.SUSPICIOUS_ACTIVITY]: 'Unusual activity detected.',
  [ErrorCodes.BOT_DETECTED]: 'Automated access is not allowed.',
  
  [ErrorCodes.BUSINESS_RULE_VIOLATION]: 'This operation violates business rules.',
  [ErrorCodes.INVALID_OPERATION]: 'This operation is not allowed.',
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'This resource already exists.',
  
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'An external service is temporarily unavailable.',
  [ErrorCodes.EXTERNAL_SERVICE_TIMEOUT]: 'External service request timed out.',
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: 'External service is currently unavailable.',
  
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ErrorCodes.DATABASE_ERROR]: 'A database error occurred.',
  [ErrorCodes.CACHE_ERROR]: 'A caching error occurred.',
  [ErrorCodes.FILE_SYSTEM_ERROR]: 'A file system error occurred.',
  
  [ErrorCodes.UNKNOWN_ERROR]: 'An unknown error occurred.',
};
