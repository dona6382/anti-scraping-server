/**
 * Base Domain Exception
 * 모든 도메인 예외의 기본 클래스
 */
export abstract class DomainException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * IP가 블랙리스트에 있을 때 발생하는 예외
 */
export class IpBlacklistedException extends DomainException {
  constructor(ip: string, reason?: string) {
    super(
      `IP address ${ip} is blacklisted`,
      'IP_BLACKLISTED',
      403,
      { ip, reason }
    );
  }
}

/**
 * Rate Limit 초과 예외
 */
export class RateLimitExceededException extends DomainException {
  constructor(limit: number, resetAt: Date) {
    super(
      `Rate limit exceeded. Limit: ${limit}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, resetAt }
    );
  }
}

/**
 * 잘못된 User-Agent 예외
 */
export class InvalidUserAgentException extends DomainException {
  constructor(userAgent: string, reason: string) {
    super(
      `Invalid User-Agent: ${reason}`,
      'INVALID_USER_AGENT',
      403,
      { userAgent, reason }
    );
  }
}

/**
 * 봇 탐지 예외
 */
export class BotDetectedException extends DomainException {
  constructor(type: string, evidence: string[]) {
    super(
      `Bot detected: ${type}`,
      'BOT_DETECTED',
      403,
      { type, evidence }
    );
  }
}

/**
 * Honeypot 트리거 예외
 */
export class HoneypotTriggedException extends DomainException {
  constructor(field: string) {
    super(
      'Honeypot field was filled',
      'HONEYPOT_TRIGGERED',
      403,
      { field }
    );
  }
}

/**
 * reCAPTCHA 검증 실패 예외
 */
export class RecaptchaVerificationException extends DomainException {
  constructor(score: number, threshold: number) {
    super(
      `reCAPTCHA verification failed. Score: ${score}, Required: ${threshold}`,
      'RECAPTCHA_FAILED',
      403,
      { score, threshold }
    );
  }
}

/**
 * 헤드리스 브라우저 탐지 예외
 */
export class HeadlessBrowserException extends DomainException {
  constructor(browser: string, indicators: string[]) {
    super(
      `Headless browser detected: ${browser}`,
      'HEADLESS_BROWSER_DETECTED',
      403,
      { browser, indicators }
    );
  }
}

/**
 * 검증 실패 예외
 */
export class ValidationException extends DomainException {
  constructor(field: string, value: any, constraints: string[]) {
    super(
      `Validation failed for field: ${field}`,
      'VALIDATION_FAILED',
      400,
      { field, value, constraints }
    );
  }
}

/**
 * 리소스를 찾을 수 없을 때 예외
 */
export class ResourceNotFoundException extends DomainException {
  constructor(resource: string, id: string) {
    super(
      `${resource} with id ${id} not found`,
      'RESOURCE_NOT_FOUND',
      404,
      { resource, id }
    );
  }
}

/**
 * 권한 부족 예외
 */
export class UnauthorizedException extends DomainException {
  constructor(action: string, resource?: string) {
    super(
      `Unauthorized to perform action: ${action}`,
      'UNAUTHORIZED',
      401,
      { action, resource }
    );
  }
}

/**
 * 접근 거부 예외
 */
export class AccessDeniedException extends DomainException {
  constructor(resource: string, reason?: string) {
    super(
      `Access denied to resource: ${resource}`,
      'ACCESS_DENIED',
      403,
      { resource, reason }
    );
  }
}

/**
 * 중복 리소스 예외
 */
export class DuplicateResourceException extends DomainException {
  constructor(resource: string, field: string, value: any) {
    super(
      `${resource} with ${field}='${value}' already exists`,
      'DUPLICATE_RESOURCE',
      409,
      { resource, field, value }
    );
  }
}

/**
 * 외부 서비스 오류 예외
 */
export class ExternalServiceException extends DomainException {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { service, originalError: originalError?.message }
    );
  }
}

/**
 * 설정 오류 예외
 */
export class ConfigurationException extends DomainException {
  constructor(key: string, reason: string) {
    super(
      `Configuration error for ${key}: ${reason}`,
      'CONFIGURATION_ERROR',
      500,
      { key, reason }
    );
  }
}
