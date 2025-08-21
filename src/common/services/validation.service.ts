import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtendedRequest } from '../../types';
import { SecurityServiceBase } from './base-service';

/**
 * Request Validation Service
 * 모든 요청 검증 로직을 중앙화
 */
@Injectable()
export class ValidationService extends SecurityServiceBase {
  private readonly logger = new Logger(ValidationService.name);
  private readonly blockedUserAgents: string[];
  private readonly suspiciousPatterns: RegExp[];

  constructor(configService: ConfigService) {
    super(configService);
    
    // 차단할 User-Agent 목록 로드
    this.blockedUserAgents = this.getArrayConfig('BLOCKED_USER_AGENTS');
    
    // 의심스러운 패턴 초기화
    this.suspiciousPatterns = this.initializeSuspiciousPatterns();
  }

  /**
   * User-Agent 유효성 검사
   */
  isValidUserAgent(userAgent: string): boolean {
    // 빈 User-Agent 처리
    if (!userAgent || userAgent.length === 0) {
      return !this.strictMode; // strict 모드에서는 거부
    }

    // 차단된 User-Agent 검사
    const lowerUserAgent = userAgent.toLowerCase();
    if (this.blockedUserAgents.some(blocked => lowerUserAgent.includes(blocked))) {
      this.logger.warn(`Blocked User-Agent detected: ${userAgent.substring(0, 100)}`);
      return false;
    }

    // Strict 모드에서 추가 검사
    if (this.strictMode) {
      return !this.isSuspiciousUserAgent(userAgent);
    }

    return true;
  }

  /**
   * 헤드리스 브라우저 감지
   */
  detectHeadlessBrowser(request: ExtendedRequest): {
    isHeadless: boolean;
    confidence: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    const userAgent = request.headers['user-agent'];
    if (!userAgent) {
      factors.push('Missing User-Agent');
      score += 30;
    } else {
      const ua = Array.isArray(userAgent) ? userAgent[0] : userAgent;
      
      if (ua) {
        // 헤드리스 표시자 검사
        const headlessIndicators = ['headless', 'phantomjs', 'puppeteer', 'playwright'];
        if (headlessIndicators.some(indicator => ua.toLowerCase().includes(indicator))) {
          factors.push('Headless indicator in User-Agent');
          score += 100;
        }
      }
    }

    // 필수 헤더 검사
    const requiredHeaders = ['accept-language', 'accept-encoding', 'accept'];
    const missingHeaders = requiredHeaders.filter(header => !request.headers[header]);
    
    if (missingHeaders.length > 0) {
      factors.push(`Missing headers: ${missingHeaders.join(', ')}`);
      score += missingHeaders.length * 20;
    }

    // Chrome 관련 헤더 검사
    if (userAgent && userAgent.toString().includes('Chrome')) {
      if (!request.headers['sec-ch-ua']) {
        factors.push('Missing Sec-CH-UA for Chrome');
        score += 25;
      }
    }

    return {
      isHeadless: score >= 50,
      confidence: Math.min(score, 100),
      factors,
    };
  }

  /**
   * Honeypot 필드 검증
   */
  validateHoneypot(
    body: Record<string, unknown>,
    fieldName: string,
    timeThreshold: number
  ): {
    isValid: boolean;
    reason?: string;
  } {
    // Honeypot 필드가 채워져 있는지 검사
    if (body[fieldName]) {
      return {
        isValid: false,
        reason: `Honeypot field '${fieldName}' was filled`,
      };
    }

    // 시간 기반 검사
    const submitTime = body._submitTime as number | undefined;
    const renderTime = body._renderTime as number | undefined;
    
    if (submitTime && renderTime) {
      const timeDiff = submitTime - renderTime;
      if (timeDiff < timeThreshold) {
        return {
          isValid: false,
          reason: `Form submitted too quickly: ${timeDiff}ms`,
        };
      }
    }

    // 추가 숨겨진 필드 검사
    const suspiciousFields = [
      'username_confirm',
      'email_verify',
      'name_check',
      'url_check',
    ];

    const detectedFields = suspiciousFields.filter(field => 
      body[field] !== undefined && body[field] !== ''
    );

    if (detectedFields.length > 0) {
      return {
        isValid: false,
        reason: `Suspicious fields detected: ${detectedFields.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * IP 주소 검증 및 분석
   */
  analyzeIpAddress(ip: string): {
    isValid: boolean;
    isPrivate: boolean;
    type: 'ipv4' | 'ipv6' | 'invalid';
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const isValid = this.isValidIpAddress(ip);
    const isPrivate = this.isPrivateIp(ip);
    
    let type: 'ipv4' | 'ipv6' | 'invalid' = 'invalid';
    if (isValid) {
      type = ip.includes(':') ? 'ipv6' : 'ipv4';
    }

    // 위험 수준 평가
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (!isValid || ip === 'unknown') {
      riskLevel = 'high';
    } else if (isPrivate) {
      riskLevel = 'medium';
    }

    return {
      isValid,
      isPrivate,
      type,
      riskLevel,
    };
  }

  /**
   * 요청 속도 분석
   */
  analyzeRequestRate(
    requestCount: number,
    timeWindow: number
  ): {
    rate: number;
    isExcessive: boolean;
    recommendation: string;
  } {
    const rate = requestCount / (timeWindow / 1000); // requests per second
    const isExcessive = rate > 1; // 1 request per second threshold

    let recommendation = 'Normal traffic';
    if (rate > 10) {
      recommendation = 'Block immediately';
    } else if (rate > 5) {
      recommendation = 'Apply strict rate limiting';
    } else if (rate > 1) {
      recommendation = 'Monitor closely';
    }

    return {
      rate,
      isExcessive,
      recommendation,
    };
  }

  /**
   * 종합 보안 점수 계산
   */
  calculateSecurityScore(request: ExtendedRequest): {
    score: number;
    factors: Record<string, number>;
    recommendation: string;
  } {
    const factors: Record<string, number> = {};
    let totalScore = 100; // 시작 점수

    // IP 분석
    const ip = this.extractClientIp(request);
    const ipAnalysis = this.analyzeIpAddress(ip);
    if (!ipAnalysis.isValid) {
      factors.invalidIp = -30;
      totalScore -= 30;
    }
    if (ipAnalysis.isPrivate) {
      factors.privateIp = -10;
      totalScore -= 10;
    }

    // User-Agent 분석
    const userAgent = this.extractUserAgent(request);
    if (!this.isValidUserAgent(userAgent)) {
      factors.invalidUserAgent = -25;
      totalScore -= 25;
    }

    // 헤드리스 브라우저 감지
    const headlessDetection = this.detectHeadlessBrowser(request);
    if (headlessDetection.isHeadless) {
      factors.headlessBrowser = -headlessDetection.confidence;
      totalScore -= headlessDetection.confidence;
    }

    // 헤더 완전성 체크
    const requiredHeaders = ['accept', 'accept-language', 'accept-encoding'];
    const missingHeaders = requiredHeaders.filter(h => !request.headers[h]);
    if (missingHeaders.length > 0) {
      factors.missingHeaders = -missingHeaders.length * 5;
      totalScore -= missingHeaders.length * 5;
    }

    // 점수 정규화 (0-100)
    totalScore = Math.max(0, Math.min(100, totalScore));

    // 권장사항 결정
    let recommendation = 'Allow';
    if (totalScore < 30) {
      recommendation = 'Block';
    } else if (totalScore < 50) {
      recommendation = 'Challenge with CAPTCHA';
    } else if (totalScore < 70) {
      recommendation = 'Apply rate limiting';
    }

    return {
      score: totalScore,
      factors,
      recommendation,
    };
  }

  /**
   * 의심스러운 User-Agent 패턴 초기화
   */
  private initializeSuspiciousPatterns(): RegExp[] {
    return [
      /bot/i,
      /spider/i,
      /crawl/i,
      /scrape/i,
      /harvest/i,
      /extract/i,
      /grab/i,
      /fetch/i,
      /mine/i,
      /scan/i,
    ];
  }

  /**
   * 의심스러운 User-Agent 검사
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const allowedBots = [
      'googlebot',
      'bingbot',
      'slackbot',
      'twitterbot',
      'facebookexternalhit',
    ];

    const lowerUA = userAgent.toLowerCase();
    const isAllowedBot = allowedBots.some(bot => lowerUA.includes(bot));
    
    if (isAllowedBot) {
      return false;
    }

    return this.suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * IP 추출 (중복 제거)
   */
  private extractClientIp(request: ExtendedRequest): string {
    return request.clientInfo?.ip || request.ip || 'unknown';
  }

  /**
   * User-Agent 추출 (중복 제거)
   */
  private extractUserAgent(request: ExtendedRequest): string {
    const userAgent = request.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] || '' : userAgent || '';
  }
}
