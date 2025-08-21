import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

// Guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// Services
import { 
  TestingBusinessService, 
  TestRequestData, 
  TestResult, 
  SecurityTestResults 
} from '../services';

// DTOs
import {
  BaseResponseDto,
  TestRequestDto,
} from '../common/dto';

/**
 * Test Controller
 * 보안 가드들의 개별 테스트를 위한 엔드포인트 (비즈니스 로직 분리됨)
 */
@ApiTags('Security Testing')
@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(private readonly testingBusinessService: TestingBusinessService) {}

  /**
   * User-Agent Guard 테스트
   */
  @Post('user-agent')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test User-Agent guard',
    description: `Test the User-Agent filtering guard.`
  })
  @ApiResponse({
    status: 200,
    description: 'User-Agent Guard passed',
    type: BaseResponseDto
  })
  @ApiForbiddenResponse({ 
    description: 'User-Agent blocked - detected bot or suspicious pattern'
  })
  async testUserAgent(@Req() request: Request): Promise<BaseResponseDto<any>> {
    this.logger.log('Testing User-Agent guard');

    const testResult = await this.testingBusinessService.testUserAgent(request);
    
    return new BaseResponseDto(
      {
        message: testResult.message,
        userAgent: testResult.data.userAgent,
        analysis: testResult.data.analysis
      },
      testResult.message
    );
  }

  /**
   * IP Blacklist Guard 테스트
   */
  @Post('ip-blacklist')
  @UseGuards(IpBlacklistGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test IP blacklist guard',
    description: `Test the IP blacklist protection.`
  })
  @ApiResponse({
    status: 200,
    description: 'IP Blacklist Guard passed',
    type: BaseResponseDto
  })
  @ApiForbiddenResponse({ 
    description: 'IP address blocked - found in blacklist'
  })
  async testIpBlacklist(@Req() request: Request): Promise<BaseResponseDto<any>> {
    this.logger.log('Testing IP blacklist guard');

    const testResult = await this.testingBusinessService.testIpBlacklist(request);
    
    return new BaseResponseDto(
      {
        message: testResult.message,
        ipAddress: testResult.data.ipAddress,
        blacklistStatus: testResult.data.blacklistStatus
      },
      testResult.message
    );
  }

  /**
   * Honeypot Guard 테스트
   */
  @Post('honeypot')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test honeypot guard',
    description: `Test the honeypot field detection.`
  })
  @ApiBody({ type: TestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Honeypot Guard passed',
    type: BaseResponseDto
  })
  @ApiForbiddenResponse({ 
    description: 'Honeypot triggered - bot behavior detected'
  })
  async testHoneypot(
    @Body() testDto: TestRequestDto,
    @Req() request: Request
  ): Promise<BaseResponseDto<any>> {
    this.logger.log('Testing Honeypot guard');

    const requestData: TestRequestData = {
      ...(testDto.name && { name: testDto.name }),
      ...(testDto.email && { email: testDto.email }),
      ...(testDto.message && { message: testDto.message })
    };

    const testResult = await this.testingBusinessService.testHoneypot(requestData, request);
    
    return new BaseResponseDto(
      {
        message: testResult.message,
        receivedData: testResult.data.receivedData,
        honeypotStatus: testResult.data.honeypotAnalysis.triggered ? 'Triggered' : 'No honeypot fields detected',
        analysis: testResult.data.honeypotAnalysis
      },
      testResult.message
    );
  }

  /**
   * reCAPTCHA Guard 테스트
   */
  @Post('recaptcha')
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test reCAPTCHA guard',
    description: `Test the reCAPTCHA v3 verification.`
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        recaptchaToken: { type: 'string', description: 'reCAPTCHA v3 token' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'reCAPTCHA Guard passed'
  })
  @ApiForbiddenResponse({ 
    description: 'reCAPTCHA verification failed'
  })
  async testRecaptcha(
    @Body() body: { recaptchaToken?: string },
    @Req() request: Request
  ): Promise<BaseResponseDto<any>> {
    this.logger.log('Testing reCAPTCHA guard');

    const token = body.recaptchaToken || 
                  request.headers['x-recaptcha-token'] as string ||
                  'test-token-' + Date.now();

    const testResult = await this.testingBusinessService.testRecaptcha(token, request);
    
    return new BaseResponseDto(
      {
        message: testResult.message,
        token: testResult.data.token,
        verification: testResult.data.verification
      },
      testResult.message
    );
  }

  /**
   * Headless Browser Guard 테스트
   */
  @Post('headless-browser')
  @UseGuards(HeadlessBrowserGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test headless browser guard',
    description: `Test the headless browser detection.`
  })
  @ApiResponse({
    status: 200,
    description: 'Headless Browser Guard passed'
  })
  @ApiForbiddenResponse({ 
    description: 'Headless browser detected'
  })
  async testHeadlessBrowser(@Req() request: Request): Promise<BaseResponseDto<any>> {
    this.logger.log('Testing Headless Browser guard');

    const testResult = await this.testingBusinessService.testHeadlessBrowser(request);
    
    return new BaseResponseDto(
      {
        message: testResult.message,
        detection: testResult.data.detection,
        browserProperties: testResult.data.browserProperties
      },
      testResult.message
    );
  }

  /**
   * 종합 보안 테스트
   */
  @Post('comprehensive')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Run comprehensive security test',
    description: `Run all security tests at once and get a comprehensive report.`
  })
  @ApiBody({ 
    type: TestRequestDto,
    required: false,
    description: 'Optional test data for honeypot testing'
  })
  @ApiResponse({
    status: 200,
    description: 'Comprehensive security test completed'
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many comprehensive tests - rate limited'
  })
  async runComprehensiveTest(
    @Body() testDto: TestRequestDto,
    @Req() request: Request
  ): Promise<BaseResponseDto<SecurityTestResults>> {
    this.logger.log('Running comprehensive security test');

    const testData: TestRequestData | undefined = testDto ? {
      ...(testDto.name && { name: testDto.name }),
      ...(testDto.email && { email: testDto.email }),
      ...(testDto.message && { message: testDto.message })
    } : undefined;

    const testResult = await this.testingBusinessService.runComprehensiveSecurityTest(request, testData);
    
    return new BaseResponseDto(
      testResult.data,
      `${testResult.message} - Overall Status: ${testResult.success ? 'SAFE' : 'SUSPICIOUS'}`
    );
  }

  /**
   * 테스트 도움말
   */
  @Get('help')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get testing help and examples',
    description: 'Get detailed information about how to test each security guard.'
  })
  @ApiResponse({
    status: 200,
    description: 'Testing help information'
  })
  async getTestingHelp(): Promise<BaseResponseDto<any>> {
    const helpInfo = {
      overview: 'This endpoint provides individual and comprehensive security testing capabilities.',
      endpoints: {
        '/test/user-agent': {
          description: 'Test User-Agent filtering',
          howToTrigger: 'Send requests with bot-like User-Agent headers (curl, python, selenium, etc.)'
        },
        '/test/ip-blacklist': {
          description: 'Test IP blacklist protection',
          howToTrigger: 'Your IP needs to be in the blacklist (contact admin to test)'
        },
        '/test/honeypot': {
          description: 'Test honeypot field detection',
          howToTrigger: 'Include hidden fields like email_confirm, website, or submit too quickly'
        },
        '/test/recaptcha': {
          description: 'Test reCAPTCHA verification',
          howToTrigger: 'Submit without valid reCAPTCHA token or with invalid token'
        },
        '/test/headless-browser': {
          description: 'Test headless browser detection',
          howToTrigger: 'Use Selenium, Puppeteer, or include "headless" in User-Agent'
        },
        '/test/comprehensive': {
          description: 'Run all tests and get comprehensive report',
          rateLimit: '5 requests per minute'
        }
      },
      examples: {
        triggerUserAgentBlock: {
          headers: { 'User-Agent': 'python-requests/2.28.0' }
        },
        triggerHoneypot: {
          body: {
            name: 'Test User',
            email: 'test@example.com',
            message: 'Hello',
            email_confirm: 'bot@example.com'
          }
        },
        triggerHeadlessDetection: {
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/91.0.4472.124' }
        }
      }
    };

    return new BaseResponseDto(
      helpInfo,
      'Testing help information retrieved successfully'
    );
  }
}
