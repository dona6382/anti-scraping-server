import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { SecurityEventService } from '../services/security-event.service';
import { ExtendedRequest } from '../../core/types';
import { HeadlessBrowserException } from '../exceptions';

/**
 * Headless Browser Detection Guard
 * Puppeteer, Playwright, Selenium 등의 헤드리스 브라우저를 감지
 */
@Injectable()
export class HeadlessBrowserGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(HeadlessBrowserGuard.name);

  constructor(private readonly securityEventService: SecurityEventService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    try {
      const detectionResult = await this.detectHeadlessBrowser(request);
      
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
  private async detectHeadlessBrowser(request: ExtendedRequest): Promise<{
    isHeadless: boolean;
    factors: string[];
    confidence: number;
  }> {
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
      confidenceScore += 100;
    }

    // 2. Chrome DevTools Protocol 감지
    const chromeDevToolsPatterns = [
      'HeadlessChrome',
      'Chrome-Lighthouse',
    ];

    if (chromeDevToolsPatterns.some(pattern => userAgent.includes(pattern.toLowerCase()))) {
      factors.push('Chrome DevTools Protocol detected');
      confidenceScore += 90;
    }

    // 3. 자동화 도구 감지
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
        confidenceScore += 80;
      }
    }

    // 4. 누락된 헤더 검사
    const requiredHeaders = [
      'accept-language',
      'accept-encoding',
      'accept',
    ];

    const missingHeaders = requiredHeaders.filter(
      header => !request.headers[header]
    );

    if (missingHeaders.length > 0) {
      factors.push(`Missing headers: ${missingHeaders.join(', ')}`);
      confidenceScore += missingHeaders.length * 20;
    }

    // 5. 의심스러운 헤더 값 검사
    const acceptLanguage = this.getHeader(request, 'accept-language');
    if (acceptLanguage === '*' || acceptLanguage === 'en-US') {
      factors.push('Suspicious Accept-Language header');
      confidenceScore += 15;
    }

    // 6. WebDriver 프로퍼티 체크 (클라이언트 측 체크가 필요하지만 여기서는 헤더로 추정)
    const secChUa = this.getHeader(request, 'sec-ch-ua');
    if (!secChUa && userAgent.includes('chrome')) {
      factors.push('Missing Sec-CH-UA header for Chrome');
      confidenceScore += 25;
    }

    // 7. Connection 헤더 검사
    const connection = this.getHeader(request, 'connection');
    if (connection && connection.toLowerCase() === 'close') {
      factors.push('Connection: close header detected');
      confidenceScore += 10;
    }

    // 8. 비정상적인 Accept 헤더
    const accept = this.getHeader(request, 'accept');
    if (!accept || accept === '*/*') {
      factors.push('Missing or generic Accept header');
      confidenceScore += 15;
    }

    // 9. 플러그인/벤더 정보 부재 (User-Agent 분석)
    if (userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('opr')) {
      const chromeVersion = userAgent.match(/chrome\/(\d+)/);
      if (chromeVersion && chromeVersion[1]) {
        const version = parseInt(chromeVersion[1], 10);
        if (!isNaN(version) && version >= 90) {
          // Chrome 90+ should have certain features
          if (!this.getHeader(request, 'sec-fetch-site')) {
            factors.push('Missing Sec-Fetch headers for modern Chrome');
            confidenceScore += 20;
          }
        }
      }
    }

    // 임계값 기반 판단 (50점 이상이면 헤드리스로 간주)
    const isHeadless = confidenceScore >= 50;

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
