import { Injectable, Logger, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseSecurityGuard } from './base-security.guard';
import { SecurityEventService } from '../services/security-event.service';
import { ExtendedRequest } from '../../core/types';
import { HeadlessBrowserException } from '../exceptions';
import { HEADLESS_SCORES } from '../constants/threshold.constants';

/**
 * Headless Browser 체크를 건너뛰는 데코레이터
 */
const SKIP_HEADLESS_BROWSER_KEY = 'skipHeadlessBrowser';
export const SkipHeadlessBrowser = () => SetMetadata(SKIP_HEADLESS_BROWSER_KEY, true);

/**
 * Headless Browser Detection Guard
 * Puppeteer, Playwright, Selenium 등의 헤드리스 브라우저를 감지
 */
@Injectable()
export class HeadlessBrowserGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(HeadlessBrowserGuard.name);

  constructor(
    private readonly securityEventService: SecurityEventService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipHeadlessBrowser() 데코레이터가 있으면 건너뜀
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_HEADLESS_BROWSER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    try {
      const detectionResult = this.detectHeadlessBrowser(request);
      
      if (detectionResult.isHeadless) {
        this.logSecurityViolation(
          request,
          `Headless browser detected. Factors: ${detectionResult.factors.join(', ')}`,
        );

        this.securityEventService.log({
          eventType: 'HEADLESS_BROWSER_DETECTED',
          severity: 'HIGH',
          ip: this.getClientIp(request),
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: `Headless browser detected (confidence: ${detectionResult.confidence})`,
          eventData: {
            factors: detectionResult.factors,
            confidence: detectionResult.confidence,
          },
        });

        throw new HeadlessBrowserException(detectionResult.factors);
      }
      
      return true;
    } catch (error) {
      // 이미 우리의 예외인 경우 그대로 전달
      if (error instanceof HeadlessBrowserException) {
        throw error;
      }
      
      // 예상치 못한 에러
      this.logger.error(`Unexpected error in headless browser detection:`, error);
      
      // 에러 시 허용 (fail-open)
      return true;
    }
  }

  /**
   * 헤드리스 브라우저 감지
   */
  private detectHeadlessBrowser(request: ExtendedRequest): {
    isHeadless: boolean;
    factors: string[];
    confidence: number;
  } {
    const factors: string[] = [];
    let confidenceScore = 0;

    const userAgent = this.getUserAgent(request).toLowerCase();

    // 1. User-Agent 기반 감지
    const headlessIndicators = [
      'headless',
      'phantomjs',
      'slimerjs',
      'chrome-lighthouse',
    ];

    if (headlessIndicators.some(indicator => userAgent.includes(indicator))) {
      factors.push('User-Agent contains headless indicator');
      confidenceScore += HEADLESS_SCORES.UA_HEADLESS_INDICATOR;
    }

    // 2. Chrome DevTools Protocol
    const chromeDevToolsPatterns = ['headlesschrome', 'chrome-lighthouse'];
    if (chromeDevToolsPatterns.some(p => userAgent.includes(p))) {
      factors.push('Chrome DevTools Protocol detected');
      confidenceScore += HEADLESS_SCORES.DEVTOOLS_PROTOCOL;
    }

    // 3. Automation tools
    const automationTools = [
      { pattern: 'puppeteer', name: 'Puppeteer' },
      { pattern: 'playwright', name: 'Playwright' },
      { pattern: 'selenium', name: 'Selenium' },
      { pattern: 'webdriver', name: 'WebDriver' },
      { pattern: 'cypress', name: 'Cypress' },
    ];
    for (const tool of automationTools) {
      if (userAgent.includes(tool.pattern)) {
        factors.push(`${tool.name} detected`);
        confidenceScore += HEADLESS_SCORES.AUTOMATION_TOOL;
      }
    }

    // 4. Missing required headers
    const missingHeaders = ['accept-language', 'accept-encoding', 'accept']
      .filter(h => !request.headers[h]);
    if (missingHeaders.length > 0) {
      factors.push(`Missing headers: ${missingHeaders.join(', ')}`);
      confidenceScore += missingHeaders.length * HEADLESS_SCORES.MISSING_HEADER;
    }

    // 5. Suspicious Accept-Language
    const acceptLanguage = this.getHeader(request, 'accept-language');
    if (acceptLanguage === '*' || acceptLanguage === 'en-US') {
      factors.push('Suspicious Accept-Language header');
      confidenceScore += HEADLESS_SCORES.SUSPICIOUS_ACCEPT_LANG;
    }

    // 6. Missing Sec-CH-UA for Chrome
    const secChUa = this.getHeader(request, 'sec-ch-ua');
    if (!secChUa && userAgent.includes('chrome')) {
      factors.push('Missing Sec-CH-UA header for Chrome');
      confidenceScore += HEADLESS_SCORES.MISSING_SEC_CH_UA;
    }

    // 7. Connection: close
    const connection = this.getHeader(request, 'connection');
    if (connection?.toLowerCase() === 'close') {
      factors.push('Connection: close header detected');
      confidenceScore += HEADLESS_SCORES.CONNECTION_CLOSE;
    }

    // 8. Missing/generic Accept
    const accept = this.getHeader(request, 'accept');
    if (!accept || accept === '*/*') {
      factors.push('Missing or generic Accept header');
      confidenceScore += HEADLESS_SCORES.GENERIC_ACCEPT;
    }

    // 9. Missing Sec-Fetch headers for modern Chrome
    if (userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('opr')) {
      const chromeVersion = userAgent.match(/chrome\/(\d+)/);
      if (chromeVersion?.[1]) {
        const version = parseInt(chromeVersion[1], 10);
        if (!isNaN(version) && version >= 90 && !this.getHeader(request, 'sec-fetch-site')) {
          factors.push('Missing Sec-Fetch headers for modern Chrome');
          confidenceScore += HEADLESS_SCORES.MISSING_SEC_FETCH;
        }
      }
    }

    const isHeadless = confidenceScore >= HEADLESS_SCORES.THRESHOLD;

    if (factors.length > 0) {
      this.logger.debug(`Headless detection - Score: ${confidenceScore}, Factors: ${factors.join(', ')}`);
    }

    return {
      isHeadless,
      factors,
      confidence: Math.min(confidenceScore, 100),
    };
  }
}
