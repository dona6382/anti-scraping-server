import { Injectable, Logger } from '@nestjs/common';
import {
  ISecurityStrategy,
  IRequestContext,
  SecurityCheckResult,
  IEventPublisher,
  IMetricsCollector,
} from '../../domain/interfaces/security.interfaces';
import { 
  BotDetectedException,
  InvalidUserAgentException,
  HeadlessBrowserException,
  HoneypotTriggedException,
} from '../../domain/exceptions/domain.exceptions';
import { UserAgent } from '../../domain/value-objects/user-agent.vo';

/**
 * Security Orchestrator Service
 * 모든 보안 전략을 조율하고 실행하는 서비스
 */
@Injectable()
export class SecurityOrchestrator {
  private readonly logger = new Logger(SecurityOrchestrator.name);
  private readonly strategies: Map<string, ISecurityStrategy> = new Map();

  constructor(
    private readonly eventPublisher?: IEventPublisher,
    private readonly metricsCollector?: IMetricsCollector,
  ) {}

  /**
   * 보안 전략 등록
   */
  registerStrategy(strategy: ISecurityStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.log(`Registered security strategy: ${strategy.name}`);
  }

  /**
   * 보안 전략 제거
   */
  unregisterStrategy(name: string): void {
    this.strategies.delete(name);
    this.logger.log(`Unregistered security strategy: ${name}`);
  }

  /**
   * 모든 보안 검증 실행
   */
  async validateRequest(context: IRequestContext): Promise<SecurityCheckResult> {
    const startTime = Date.now();
    const results: SecurityCheckResult[] = [];
    
    // Priority 순으로 전략 정렬
    const sortedStrategies = Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of sortedStrategies) {
      try {
        const result = await this.executeStrategy(strategy, context);
        results.push(result);

        // 실패한 경우 즉시 중단
        if (!result.passed) {
          this.handleFailure(strategy.name, result, context);
          return result;
        }
      } catch (error) {
        this.logger.error(`Strategy ${strategy.name} failed:`, error);
        // Continue with other strategies
      }
    }

    const duration = Date.now() - startTime;
    this.recordMetrics('security.validation.success', duration);

    return {
      passed: true,
      metadata: {
        strategiesExecuted: results.length,
        duration,
      },
    };
  }

  /**
   * 단일 전략 실행
   */
  private async executeStrategy(
    strategy: ISecurityStrategy,
    context: IRequestContext
  ): Promise<SecurityCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await strategy.validate(context);
      
      const duration = Date.now() - startTime;
      this.recordMetrics(`security.strategy.${strategy.name}`, duration, {
        result: result.passed ? 'pass' : 'fail',
      });

      return result;
    } catch (error) {
      this.logger.error(`Error executing strategy ${strategy.name}:`, error);
      throw error;
    }
  }

  /**
   * 검증 실패 처리
   */
  private handleFailure(
    strategyName: string,
    result: SecurityCheckResult,
    context: IRequestContext
  ): void {
    this.logger.warn(
      `Security validation failed - Strategy: ${strategyName}, Reason: ${result.failureReason}`,
      { ip: context.ip, path: context.path }
    );

    // 이벤트 발행
    this.eventPublisher?.publish('security.validation.failed', {
      strategy: strategyName,
      reason: result.failureReason,
      context: {
        ip: context.ip,
        userAgent: context.userAgent,
        path: context.path,
      },
      timestamp: new Date(),
    });

    // 메트릭 기록
    this.metricsCollector?.increment('security.validation.failures', {
      strategy: strategyName,
      reason: result.failureReason || 'unknown',
    });
  }

  /**
   * 메트릭 기록
   */
  private recordMetrics(
    metric: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    this.metricsCollector?.timing(metric, duration, tags);
  }
}

/**
 * User-Agent 검증 전략
 */
@Injectable()
export class UserAgentValidationStrategy implements ISecurityStrategy {
  readonly name = 'user-agent-validation';
  readonly priority = 1;

  private readonly blockedAgents: Set<string>;
  private readonly strictMode: boolean;

  constructor(
    blockedAgents: string[] = [],
    strictMode: boolean = false
  ) {
    this.blockedAgents = new Set(blockedAgents.map(a => a.toLowerCase()));
    this.strictMode = strictMode;
  }

  async validate(context: IRequestContext): Promise<SecurityCheckResult> {
    const userAgent = new UserAgent(context.userAgent);

    // Empty User-Agent
    if (userAgent.isEmpty()) {
      return {
        passed: false,
        failureReason: 'Missing User-Agent header',
        riskScore: 80,
      };
    }

    // Check if bot
    if (userAgent.isBot()) {
      return {
        passed: false,
        failureReason: 'Bot User-Agent detected',
        riskScore: 90,
        metadata: {
          browser: userAgent.getBrowser(),
          os: userAgent.getOS(),
        },
      };
    }

    // Check blocked list
    const normalized = userAgent.toString().toLowerCase();
    for (const blocked of this.blockedAgents) {
      if (normalized.includes(blocked)) {
        return {
          passed: false,
          failureReason: `Blocked User-Agent: ${blocked}`,
          riskScore: 100,
        };
      }
    }

    // Check suspicious patterns
    if (userAgent.hasSuspiciousPattern()) {
      return {
        passed: false,
        failureReason: 'Suspicious User-Agent pattern',
        riskScore: userAgent.getRiskScore(),
      };
    }

    // Strict mode checks
    if (this.strictMode) {
      if (userAgent.getBrowser() === 'unknown') {
        return {
          passed: false,
          failureReason: 'Unknown browser in strict mode',
          riskScore: 70,
        };
      }
    }

    return {
      passed: true,
      riskScore: userAgent.getRiskScore(),
      metadata: {
        browser: userAgent.getBrowser(),
        os: userAgent.getOS(),
        isMobile: userAgent.isMobile(),
      },
    };
  }
}

/**
 * Headless Browser 검증 전략
 */
@Injectable()
export class HeadlessBrowserDetectionStrategy implements ISecurityStrategy {
  readonly name = 'headless-browser-detection';
  readonly priority = 2;

  async validate(context: IRequestContext): Promise<SecurityCheckResult> {
    const userAgent = new UserAgent(context.userAgent);
    const indicators: string[] = [];

    // Check if headless
    if (userAgent.isHeadless()) {
      indicators.push('User-Agent contains headless indicator');
    }

    // Check Chrome specific patterns
    if (this.isHeadlessChrome(context)) {
      indicators.push('Chrome headless pattern detected');
    }

    // Check missing headers
    const missingHeaders = this.checkRequiredHeaders(context);
    if (missingHeaders.length > 0) {
      indicators.push(`Missing headers: ${missingHeaders.join(', ')}`);
    }

    // Check WebDriver
    if (this.hasWebDriverSignature(context)) {
      indicators.push('WebDriver signature detected');
    }

    if (indicators.length > 0) {
      return {
        passed: false,
        failureReason: 'Headless browser detected',
        riskScore: 95,
        metadata: { indicators },
      };
    }

    return { passed: true, riskScore: 0 };
  }

  private isHeadlessChrome(context: IRequestContext): boolean {
    const ua = context.userAgent.toLowerCase();
    
    // Chrome version pattern check
    if (/chrome\/\d+\.0\.0\.0/.test(ua)) {
      return true;
    }

    // Check for missing Chrome headers
    if (ua.includes('chrome')) {
      const chromeHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];
      const hasSecHeaders = chromeHeaders.some(h => context.headers[h]);
      
      if (!hasSecHeaders && !this.isOldChrome(ua)) {
        return true;
      }
    }

    return false;
  }

  private isOldChrome(userAgent: string): boolean {
    const match = userAgent.match(/chrome\/(\d+)/i);
    if (match) {
      const version = parseInt(match[1], 10);
      return version < 90;
    }
    return false;
  }

  private checkRequiredHeaders(context: IRequestContext): string[] {
    const required = ['accept-language', 'accept-encoding'];
    return required.filter(header => !context.headers[header]);
  }

  private hasWebDriverSignature(context: IRequestContext): boolean {
    // Check for webdriver property in headers
    return context.headers['webdriver'] === 'true' ||
           context.headers['phantomjs'] !== undefined;
  }
}

/**
 * Honeypot 검증 전략
 */
@Injectable()
export class HoneypotValidationStrategy implements ISecurityStrategy {
  readonly name = 'honeypot-validation';
  readonly priority = 3;

  constructor(
    private readonly honeypotFields: string[] = ['email_confirm', 'name_confirm'],
    private readonly timeThreshold: number = 2000
  ) {}

  async validate(context: IRequestContext): Promise<SecurityCheckResult> {
    // Only check POST/PUT requests
    if (!['POST', 'PUT', 'PATCH'].includes(context.method)) {
      return { passed: true, riskScore: 0 };
    }

    const body = context.body || {};

    // Check honeypot fields
    for (const field of this.honeypotFields) {
      if (this.isHoneypotFilled(body, field)) {
        return {
          passed: false,
          failureReason: `Honeypot field filled: ${field}`,
          riskScore: 100,
          metadata: { field, value: body[field] },
        };
      }
    }

    // Check submission time
    if (this.isTooFast(body)) {
      return {
        passed: false,
        failureReason: 'Form submitted too quickly',
        riskScore: 90,
        metadata: { timeThreshold: this.timeThreshold },
      };
    }

    return { passed: true, riskScore: 0 };
  }

  private isHoneypotFilled(body: any, field: string): boolean {
    if (!(field in body)) return false;
    
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      return false;
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }
    
    return true;
  }

  private isTooFast(body: any): boolean {
    if (!body._timestamp) return false;

    try {
      const timestamp = parseInt(body._timestamp, 10);
      if (isNaN(timestamp)) return false;

      const now = Date.now();
      const diff = now - timestamp;

      return diff > 0 && diff < this.timeThreshold;
    } catch {
      return false;
    }
  }
}
