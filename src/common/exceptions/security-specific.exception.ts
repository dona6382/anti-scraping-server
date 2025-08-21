import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Security Specific Exceptions
 * application.exception.ts에 없는 보안 전용 예외들만 포함
 * 
 * 중복 제거된 클래스들:
 * - IpBlockedException → application.exception.ts 사용
 * - RateLimitException → application.exception.ts 사용
 * - ValidationException → application.exception.ts 사용
 * - ExternalServiceException → application.exception.ts 사용
 */

/**
 * Invalid User Agent Exception
 * User-Agent 검증 실패 시 발생
 */
export class InvalidUserAgentException extends HttpException {
  constructor(ip: string, userAgent: string) {
    const message = process.env.NODE_ENV === 'production' 
      ? 'Access denied' 
      : `Invalid User-Agent detected: ${userAgent.substring(0, 100)}`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Headless Browser Exception
 * 헤드리스 브라우저 감지 시 발생
 */
export class HeadlessBrowserException extends HttpException {
  constructor(ip: string, detectionFactors: string[]) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Access denied'
      : `Headless browser detected with ${detectionFactors.length} factors`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && { factors: detectionFactors }),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Honeypot Triggered Exception
 * 허니팟 필드가 채워진 경우 발생
 */
export class HoneypotException extends HttpException {
  constructor(ip: string, fieldName?: string) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Access denied'
      : 'Honeypot field triggered';

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * reCAPTCHA Failed Exception
 * reCAPTCHA 검증 실패 시 발생
 */
export class RecaptchaException extends HttpException {
  constructor(ip: string, score?: number) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Verification failed'
      : `reCAPTCHA verification failed${score ? ` (score: ${score})` : ''}`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Configuration Exception
 * 필수 설정이 누락된 경우 발생
 */
export class ConfigurationException extends HttpException {
  constructor(missingConfig: string) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Service temporarily unavailable'
      : `Missing required configuration: ${missingConfig}`;

    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
