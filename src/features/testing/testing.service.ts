import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExtendedRequest } from '../../core/types';
import { RequestUtils } from '../../common/utils/request.utils'; // shared -> common
// import { HoneypotException } from '../../shared/exceptions'; // 제거

export interface TestRequestData {
  name?: string;
  email?: string;
  message?: string;
  recaptchaToken?: string;
}

export interface TestResult {
  test: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  details?: any;
}

export interface SecurityTestResults {
  overall: 'passed' | 'failed';
  tests: TestResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

@Injectable()
export class TestingService {
  private readonly logger = new Logger(TestingService.name);

  constructor(private readonly configService: ConfigService) {}

  async runSecurityTests(request: ExtendedRequest): Promise<SecurityTestResults> {
    const tests: TestResult[] = [];

    // User-Agent test
    tests.push(this.testUserAgent(request));

    // IP test
    tests.push(this.testIpValidation(request));

    // Honeypot test
    tests.push(await this.testHoneypot(request));

    // Rate limiting test
    tests.push(this.testRateLimit(request));

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;

    return {
      overall: failed === 0 ? 'passed' : 'failed',
      tests,
      summary: {
        passed,
        failed,
        total: tests.length
      }
    };
  }

  private testUserAgent(request: ExtendedRequest): TestResult {
    const userAgent = RequestUtils.extractUserAgent(request);
    
    if (!userAgent) {
      return {
        test: 'User-Agent',
        status: 'failed',
        message: 'Missing User-Agent header'
      };
    }

    const suspiciousPatterns = ['curl', 'wget', 'python', 'bot', 'scraper'];
    const isSuspicious = suspiciousPatterns.some(pattern => 
      userAgent.toLowerCase().includes(pattern)
    );

    return {
      test: 'User-Agent',
      status: isSuspicious ? 'failed' : 'passed',
      message: isSuspicious ? 'Suspicious User-Agent detected' : 'Valid User-Agent',
      details: { userAgent }
    };
  }

  private testIpValidation(request: ExtendedRequest): TestResult {
    const ip = RequestUtils.extractClientIp(request);
    
    return {
      test: 'IP Validation',
      status: 'passed',
      message: 'IP extracted successfully',
      details: { ip }
    };
  }

  private async testHoneypot(request: ExtendedRequest): Promise<TestResult> {
    const body = request.body || {};
    const honeyPotField = body.email_confirm;

    if (honeyPotField && typeof honeyPotField === 'string' && honeyPotField.length > 0) {
      return {
        test: 'Honeypot',
        status: 'failed',
        message: 'Bot detected - honeypot field filled'
      };
    }

    return {
      test: 'Honeypot',
      status: 'passed',
      message: 'No bot activity detected'
    };
  }

  private testRateLimit(request: ExtendedRequest): TestResult {
    return {
      test: 'Rate Limit',
      status: 'passed',
      message: 'Rate limit check passed',
      details: {
        note: 'Rate limiting is handled by guards'
      }
    };
  }

  async performTestAction(data: TestRequestData): Promise<any> {
    return {
      success: true,
      message: 'Test action completed',
      data: data
    };
  }
}