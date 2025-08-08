import { RequestContext, SecurityCheckResult } from '../types/request.types';

/**
 * 보안 검증 전략 인터페이스
 */
export interface SecurityStrategy {
  validate(context: RequestContext): Promise<SecurityCheckResult> | SecurityCheckResult;
  getName(): string;
}

/**
 * User-Agent 검증 전략
 */
export class UserAgentValidationStrategy implements SecurityStrategy {
  constructor(
    private readonly blockedAgents: Set<string>,
    private readonly suspiciousPatterns: RegExp[],
    private readonly strictMode: boolean = false,
  ) {}

  validate(context: RequestContext): SecurityCheckResult {
    if (!context.userAgent) {
      return SecurityCheckResult.fail('Missing User-Agent');
    }

    if (!this.isValidLength(context.userAgent)) {
      return SecurityCheckResult.fail('Invalid User-Agent length', {
        length: context.userAgent.length,
      });
    }

    const normalized = context.userAgent.toLowerCase();

    if (this.isBlocked(normalized)) {
      return SecurityCheckResult.fail('Blocked User-Agent');
    }

    if (this.isSuspicious(context.userAgent)) {
      return SecurityCheckResult.fail('Suspicious User-Agent pattern');
    }

    if (this.strictMode && !this.isBrowser(context.userAgent)) {
      return SecurityCheckResult.fail('Non-browser User-Agent in strict mode');
    }

    return SecurityCheckResult.pass();
  }

  getName(): string {
    return 'UserAgentValidation';
  }

  private isValidLength(userAgent: string): boolean {
    return userAgent.length >= 10 && userAgent.length <= 500;
  }

  private isBlocked(userAgent: string): boolean {
    if (this.blockedAgents.has(userAgent)) {
      return true;
    }

    for (const blocked of this.blockedAgents) {
      if (userAgent.includes(blocked)) {
        return true;
      }
    }

    return false;
  }

  private isSuspicious(userAgent: string): boolean {
    return this.suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private isBrowser(userAgent: string): boolean {
    const browserKeywords = ['Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
    return browserKeywords.some((keyword) => userAgent.includes(keyword));
  }
}

/**
 * Headless Browser 검증 전략
 */
export class HeadlessBrowserValidationStrategy implements SecurityStrategy {
  private readonly headlessSignatures = [
    'HeadlessChrome',
    'Headless',
    'PhantomJS',
    'Nightmare',
    'Electron',
  ];

  validate(context: RequestContext): SecurityCheckResult {
    const userAgent = context.userAgent.toLowerCase();

    // Check headless signatures
    for (const signature of this.headlessSignatures) {
      if (userAgent.includes(signature.toLowerCase())) {
        return SecurityCheckResult.fail('Headless browser detected', {
          signature,
        });
      }
    }

    // Check Chrome specific patterns
    if (this.isChromeHeadless(context)) {
      return SecurityCheckResult.fail('Chrome headless pattern detected');
    }

    // Check missing headers
    const missingHeaders = this.checkRequiredHeaders(context);
    if (missingHeaders.length > 0) {
      // Warning only, don't block
      return SecurityCheckResult.pass();
    }

    return SecurityCheckResult.pass();
  }

  getName(): string {
    return 'HeadlessBrowserValidation';
  }

  private isChromeHeadless(context: RequestContext): boolean {
    const userAgent = context.userAgent;

    if (/Chrome\/\d+\.0\.0\.0/.test(userAgent)) {
      return true;
    }

    if (userAgent.includes('Chrome')) {
      const chromeHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];
      const hasSecHeaders = chromeHeaders.some((header) => context.headers[header]);

      if (!hasSecHeaders && !this.isOldChrome(userAgent)) {
        return true;
      }
    }

    return false;
  }

  private isOldChrome(userAgent: string): boolean {
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      const version = parseInt(match[1], 10);
      return version < 90;
    }
    return false;
  }

  private checkRequiredHeaders(context: RequestContext): string[] {
    const required = ['accept-language', 'accept-encoding', 'accept'];
    return required.filter((header) => !context.headers[header]);
  }
}

/**
 * Honeypot 검증 전략
 */
export class HoneypotValidationStrategy implements SecurityStrategy {
  constructor(
    private readonly honeypotFields: string[],
    private readonly timeThreshold: number = 2000,
  ) {}

  validate(context: RequestContext): SecurityCheckResult {
    if (context.method === 'GET') {
      return SecurityCheckResult.pass();
    }

    const body = context.body || {};

    // Check honeypot fields
    for (const field of this.honeypotFields) {
      if (this.isFieldFilled(body, field)) {
        return SecurityCheckResult.fail('Honeypot triggered', {
          field,
          value: body[field],
        });
      }
    }

    // Check timing
    if (this.isTimingTriggered(body)) {
      return SecurityCheckResult.fail('Form submitted too quickly');
    }

    return SecurityCheckResult.pass();
  }

  getName(): string {
    return 'HoneypotValidation';
  }

  private isFieldFilled(body: any, field: string): boolean {
    if (!(field in body)) {
      return false;
    }

    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' && value.trim() !== '') {
        return true;
      }
      if (typeof value !== 'string') {
        return true;
      }
    }

    return false;
  }

  private isTimingTriggered(body: any): boolean {
    if (!body._timestamp) {
      return false;
    }

    try {
      const timestamp = parseInt(body._timestamp, 10);
      if (isNaN(timestamp)) {
        return false;
      }

      const now = Date.now();
      const diff = now - timestamp;

      return diff > 0 && diff < this.timeThreshold;
    } catch {
      return false;
    }
  }
}
