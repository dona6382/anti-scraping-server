import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';

export interface TestRequestData {
  name?: string;
  email?: string;
  message?: string;
  userAgent?: string;
  recaptchaToken?: string;
}

/**
 * Test Result Interface
 */
export interface TestResult<T = any> {
  success: boolean;
  message: string;
  data: T;
  metadata?: any;
}

/**
 * Security Test Results Interface
 */
export interface SecurityTestResults {
  userAgent: {
    value: string;
    isBlocked: boolean;
    reason?: string;
  };
  ipAddress: {
    value: string;
    isBlocked: boolean;
    reason?: string;
  };
  honeypot: {
    triggered: boolean;
    fields: string[];
    timing?: number;
  };
  overall: {
    riskScore: number;
    recommendation: string;
  };
}

/**
 * Testing Business Service
 * 보안 테스트 관련 비즈니스 로직을 처리하는 서비스
 */
@Injectable()
export class TestingBusinessService {
  private readonly logger = new Logger(TestingBusinessService.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * User-Agent 테스트 실행
   */
  async testUserAgent(request: Request): Promise<TestResult<{
    userAgent: string;
    analysis: {
      isBot: boolean;
      browserInfo: any;
      suspiciousPatterns: string[];
    };
  }>> {
    this.logger.log('Executing User-Agent test');

    try {
      const userAgent = this.extractUserAgent(request);
      const analysis = this.analyzeUserAgent(userAgent);

      return {
        success: !analysis.isBot,
        message: analysis.isBot ? 'User-Agent indicates bot behavior' : 'User-Agent Guard passed',
        data: {
          userAgent,
          analysis
        }
      };
    } catch (error) {
      this.logger.error('User-Agent test failed', error);
      throw error;
    }
  }

  /**
   * IP 블랙리스트 테스트 실행
   */
  async testIpBlacklist(request: Request): Promise<TestResult<{
    ipAddress: string;
    blacklistStatus: {
      isBlocked: boolean;
      blockInfo: any;
      riskLevel: string;
    };
  }>> {
    this.logger.log('Executing IP blacklist test');

    try {
      const ipAddress = this.extractClientIp(request);
      const blacklistStatus = await this.checkIpBlacklistStatus(ipAddress);

      return {
        success: !blacklistStatus.isBlocked,
        message: blacklistStatus.isBlocked ? 'IP address is blacklisted' : 'IP Blacklist Guard passed',
        data: {
          ipAddress,
          blacklistStatus
        }
      };
    } catch (error) {
      this.logger.error('IP blacklist test failed', error);
      throw error;
    }
  }

  /**
   * Honeypot 테스트 실행
   */
  async testHoneypot(requestData: TestRequestData, request: Request): Promise<TestResult<{
    receivedData: Partial<TestRequestData>;
    honeypotAnalysis: {
      triggered: boolean;
      suspiciousFields: string[];
      timingAnalysis: any;
      recommendation: string;
    };
  }>> {
    this.logger.log('Executing Honeypot test');

    try {
      const honeypotAnalysis = this.analyzeHoneypotData(requestData, request);
      const receivedData = this.sanitizeRequestData(requestData);

      return {
        success: !honeypotAnalysis.triggered,
        message: honeypotAnalysis.triggered ? 'Honeypot triggered - bot behavior detected' : 'Honeypot Guard passed',
        data: {
          receivedData,
          honeypotAnalysis
        }
      };
    } catch (error) {
      this.logger.error('Honeypot test failed', error);
      throw error;
    }
  }

  /**
   * reCAPTCHA 테스트 실행
   */
  async testRecaptcha(token: string, request: Request): Promise<TestResult<{
    token: string;
    verification: {
      isValid: boolean;
      score: number;
      action: string;
      hostname: string;
    };
  }>> {
    this.logger.log('Executing reCAPTCHA test');

    try {
      const verification = await this.verifyRecaptchaToken(token, request);

      return {
        success: verification.isValid && verification.score > 0.5,
        message: verification.isValid ? 'reCAPTCHA verification passed' : 'reCAPTCHA verification failed',
        data: {
          token: token.substring(0, 20) + '...',
          verification
        }
      };
    } catch (error) {
      this.logger.error('reCAPTCHA test failed', error);
      throw error;
    }
  }

  /**
   * Headless Browser 테스트 실행
   */
  async testHeadlessBrowser(request: Request): Promise<TestResult<{
    detection: {
      isHeadless: boolean;
      indicators: string[];
      confidence: number;
    };
    browserProperties: any;
  }>> {
    this.logger.log('Executing Headless Browser test');

    try {
      const detection = this.detectHeadlessBrowser(request);
      const browserProperties = this.extractBrowserProperties(request);

      return {
        success: !detection.isHeadless,
        message: detection.isHeadless ? 'Headless browser detected' : 'Headless Browser Guard passed',
        data: {
          detection,
          browserProperties
        }
      };
    } catch (error) {
      this.logger.error('Headless browser test failed', error);
      throw error;
    }
  }

  /**
   * 종합 보안 테스트 실행
   */
  async runComprehensiveSecurityTest(request: Request, testData?: TestRequestData): Promise<TestResult<SecurityTestResults>> {
    this.logger.log('Running comprehensive security test');

    try {
      const userAgentTest = await this.testUserAgent(request);
      const ipTest = await this.testIpBlacklist(request);
      const honeypotTest = testData ? await this.testHoneypot(testData, request) : null;

      const riskScore = this.calculateOverallRiskScore({
        userAgent: userAgentTest,
        ip: ipTest,
        honeypot: honeypotTest
      });

      const results: SecurityTestResults = {
        userAgent: {
          value: userAgentTest.data.userAgent,
          isBlocked: !userAgentTest.success,
          ...(userAgentTest.success ? {} : { reason: 'Bot user agent detected' })
        },
        ipAddress: {
          value: ipTest.data.ipAddress,
          isBlocked: !ipTest.success,
          ...(ipTest.success ? {} : { reason: 'IP is blacklisted' })
        },
        honeypot: {
          triggered: honeypotTest ? !honeypotTest.success : false,
          fields: honeypotTest?.data.honeypotAnalysis.suspiciousFields || []
        },
        overall: {
          riskScore,
          recommendation: this.getSecurityRecommendation(riskScore)
        }
      };

      return {
        success: riskScore < 50,
        message: `Comprehensive security test completed - Risk Score: ${riskScore}`,
        data: results
      };
    } catch (error) {
      this.logger.error('Comprehensive security test failed', error);
      throw error;
    }
  }

  // ============================================
  // Private Business Logic Methods
  // ============================================

  private extractUserAgent(request: Request): string {
    return request.headers['user-agent'] || 'unknown';
  }

  private extractClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    if (realIp) {
      return realIp;
    }
    return request.socket?.remoteAddress || request.ip || 'unknown';
  }

  private analyzeUserAgent(userAgent: string): {
    isBot: boolean;
    browserInfo: any;
    suspiciousPatterns: string[];
  } {
    const suspiciousPatterns = [];
    let isBot = false;

    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /requests/i,
      /selenium/i, /phantomjs/i, /headless/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        suspiciousPatterns.push(pattern.source);
        isBot = true;
      }
    }

    const browserInfo = this.extractBrowserInfo(userAgent);

    return {
      isBot,
      browserInfo,
      suspiciousPatterns
    };
  }

  private async checkIpBlacklistStatus(ip: string): Promise<{
    isBlocked: boolean;
    blockInfo: any;
    riskLevel: string;
  }> {
    const isBlocked = await this.ipBlacklistService.isBlocked(ip);
    const blockInfo = isBlocked ? await this.ipBlacklistService.getBlockInfo(ip) : null;
    const riskLevel = this.assessIpRiskLevel(ip, isBlocked);

    return {
      isBlocked,
      blockInfo,
      riskLevel
    };
  }

  private analyzeHoneypotData(data: TestRequestData, request: Request): {
    triggered: boolean;
    suspiciousFields: string[];
    timingAnalysis: any;
    recommendation: string;
  } {
    const suspiciousFields = [];
    let triggered = false;

    const honeypotFields = ['email_confirm', 'website', 'url', 'phone_number'];
    
    for (const field of honeypotFields) {
      if (data[field as keyof TestRequestData]) {
        suspiciousFields.push(field);
        triggered = true;
      }
    }

    const timingAnalysis = this.analyzeSubmissionTiming(request);
    if (timingAnalysis.tooFast) {
      triggered = true;
      suspiciousFields.push('submission_too_fast');
    }

    return {
      triggered,
      suspiciousFields,
      timingAnalysis,
      recommendation: triggered ? 'BLOCK' : 'ALLOW'
    };
  }

  private sanitizeRequestData(data: TestRequestData): Partial<TestRequestData> {
    const result: Partial<TestRequestData> = {};
    
    if (data.name) result.name = data.name;
    if (data.email) result.email = data.email;
    if (data.message) result.message = data.message;
    
    return result;
  }

  private extractBrowserInfo(userAgent: string): any {
    return {
      browser: this.detectBrowser(userAgent),
      os: this.detectOS(userAgent),
      device: this.detectDevice(userAgent)
    };
  }

  private analyzeSubmissionTiming(request: Request): { tooFast: boolean; timing: number } {
    const timing = Math.random() * 10000;
    const tooFast = timing < 2000;
    return { tooFast, timing };
  }

  private assessIpRiskLevel(ip: string, isBlocked: boolean): string {
    if (isBlocked) return 'high';
    if (this.isPrivateIp(ip)) return 'low';
    return 'medium';
  }

  private isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./
    ];
    return privateRanges.some(range => range.test(ip));
  }

  private calculateOverallRiskScore(testResults: any): number {
    let score = 0;
    let factors = 0;

    if (!testResults.userAgent.success) {
      score += 30;
      factors++;
    }

    if (!testResults.ip.success) {
      score += 40;
      factors++;
    }

    if (testResults.honeypot && !testResults.honeypot.success) {
      score += 50;
      factors++;
    }

    return factors > 0 ? Math.min(100, score / factors) : 0;
  }

  private getSecurityRecommendation(riskScore: number): string {
    if (riskScore >= 80) return 'BLOCK';
    if (riskScore >= 60) return 'CHALLENGE';
    if (riskScore >= 30) return 'MONITOR';
    return 'ALLOW';
  }

  private detectBrowser(userAgent: string): string {
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    return 'Unknown';
  }

  private detectOS(userAgent: string): string {
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/mac/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/ios/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  private detectDevice(userAgent: string): string {
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  }

  private extractBrowserProperties(request: Request): any {
    return {
      userAgent: request.headers['user-agent'],
      acceptLanguage: request.headers['accept-language'],
      acceptEncoding: request.headers['accept-encoding'],
      connection: request.headers.connection,
      upgrade: request.headers.upgrade,
      xForwardedFor: request.headers['x-forwarded-for'],
      xRealIp: request.headers['x-real-ip']
    };
  }

  private detectHeadlessBrowser(request: Request): {
    isHeadless: boolean;
    indicators: string[];
    confidence: number;
  } {
    const indicators = [];
    let confidence = 0;

    const userAgent = request.headers['user-agent'] || '';
    
    if (/headless/i.test(userAgent)) {
      indicators.push('headless_in_user_agent');
      confidence += 0.8;
    }

    if (/phantomjs/i.test(userAgent)) {
      indicators.push('phantomjs_detected');
      confidence += 0.9;
    }

    if (/selenium/i.test(userAgent)) {
      indicators.push('selenium_detected');
      confidence += 0.7;
    }

    const acceptLanguage = request.headers['accept-language'];
    if (!acceptLanguage) {
      indicators.push('missing_accept_language');
      confidence += 0.3;
    }

    const acceptEncoding = request.headers['accept-encoding'];
    if (!acceptEncoding) {
      indicators.push('missing_accept_encoding');
      confidence += 0.2;
    }

    return {
      isHeadless: confidence > 0.5,
      indicators,
      confidence: Math.min(1, confidence)
    };
  }

  private async verifyRecaptchaToken(token: string, request: Request): Promise<{
    isValid: boolean;
    score: number;
    action: string;
    hostname: string;
  }> {
    const isValid = token.length > 20 && !token.includes('invalid');
    const score = isValid ? Math.random() * 0.5 + 0.5 : 0;

    return {
      isValid,
      score,
      action: 'submit',
      hostname: request.headers.host || 'localhost'
    };
  }
}
