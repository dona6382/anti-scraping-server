import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
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

// Guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// DTOs
import {
  BaseResponseDto,
  TestRequestDto,
} from '../common/dto';

/**
 * Test Controller
 * 보안 가드들의 개별 테스트를 위한 엔드포인트
 */
@ApiTags('Security Testing')
@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  /**
   * User-Agent Guard 테스트
   */
  @Post('user-agent')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test User-Agent guard',
    description: `
    Test the User-Agent filtering guard.
    
    **What it checks:**
    - Blocks known bot user agents (scrapy, selenium, etc.)
    - Validates browser user agents
    - Detects suspicious patterns
    
    **Try with different User-Agent headers to see blocking behavior.**
    `
  })
  @ApiResponse({
    status: 200,
    description: 'User-Agent Guard passed',
    type: BaseResponseDto<{ message: string; userAgent: string }>
  })
  @ApiForbiddenResponse({ 
    description: 'User-Agent blocked - detected bot or suspicious pattern'
  })
  testUserAgent(): BaseResponseDto<{ message: string; userAgent: string }> {
    const data = { 
      message: 'User-Agent Guard passed',
      userAgent: 'detected-from-request' // 실제로는 요청에서 추출
    };
    return new BaseResponseDto(data);
  }

  /**
   * IP Blacklist Guard 테스트
   */
  @Post('ip-blacklist')
  @UseGuards(IpBlacklistGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test IP blacklist guard',
    description: `
    Test the IP blacklist protection.
    
    **What it checks:**
    - Verifies IP is not in blacklist
    - Checks for previously blocked IPs
    - Applies IP-based rate limiting
    
    **Note:** If your IP gets blocked, contact admin to unblock.
    `
  })
  @ApiResponse({
    status: 200,
    description: 'IP Blacklist Guard passed',
    type: BaseResponseDto<{ message: string; ipAddress: string }>
  })
  @ApiForbiddenResponse({ 
    description: 'IP address blocked - found in blacklist'
  })
  async testIpBlacklist(): Promise<BaseResponseDto<{ message: string; ipAddress: string }>> {
    const data = { 
      message: 'IP Blacklist Guard passed',
      ipAddress: 'detected-from-request' // 실제로는 요청에서 추출
    };
    return new BaseResponseDto(data);
  }

  /**
   * Honeypot Guard 테스트
   */
  @Post('honeypot')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test honeypot guard',
    description: `
    Test the honeypot field detection.
    
    **What it checks:**
    - Hidden form fields that bots might fill
    - Form submission timing (too fast = bot)
    - JavaScript token validation
    
    **To trigger blocking:**
    - Include 'email_confirm' field in request body
    - Submit with _timestamp indicating too fast submission
    - Submit without proper _jsToken
    `
  })
  @ApiBody({ type: TestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Honeypot Guard passed',
    type: BaseResponseDto<{ 
      message: string; 
      receivedData: Partial<TestRequestDto>;
      honeypotStatus: string;
    }>
  })
  @ApiForbiddenResponse({ 
    description: 'Honeypot triggered - bot behavior detected'
  })
  testHoneypot(
    @Body() testDto: TestRequestDto
  ): BaseResponseDto<{ 
    message: string; 
    receivedData: Partial<TestRequestDto>;
    honeypotStatus: string;
  }> {
    const receivedData = {
      name: testDto.name,
      email: testDto.email,
      message: testDto.message,
    };

    const data = {
      message: 'Honeypot Guard passed',
      receivedData,
      honeypotStatus: 'No honeypot fields detected',
    };

    return new BaseResponseDto(data);
  }

  /**
   * reCAPTCHA Guard 테스트
   */
  @Post('recaptcha')
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test reCAPTCHA guard',
    description: `
    Test the reCAPTCHA v3 verification.
    
    **What it checks:**
    - Valid reCAPTCHA token presence
    - Token verification with Google
    - Score threshold validation (>= 0.5)
    - Hostname verification
    
    **To test:** Include 'recaptchaToken' in request body.
    **Note:** Requires valid reCAPTCHA configuration.
    `
  })
  @ApiBody({ type: TestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'reCAPTCHA Guard passed',
    type: BaseResponseDto<{ 
      message: string; 
      tokenStatus: string;
      score?: number;
    }>
  })
  @ApiForbiddenResponse({ 
    description: 'reCAPTCHA verification failed - invalid token or low score'
  })
  testRecaptcha(
    @Body() testDto: TestRequestDto
  ): BaseResponseDto<{ 
    message: string; 
    tokenStatus: string;
    score?: number;
  }> {
    const data = {
      message: 'reCAPTCHA Guard passed',
      tokenStatus: testDto.recaptchaToken ? 'Token received' : 'No token provided',
      score: 0.8, // 시뮬레이션된 점수
    };

    return new BaseResponseDto(data);
  }

  /**
   * Headless Browser Guard 테스트
   */
  @Post('headless')
  @UseGuards(HeadlessBrowserGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test headless browser guard',
    description: `
    Test the headless browser detection.
    
    **What it checks:**
    - Browser fingerprint properties
    - WebDriver signatures
    - Headless browser indicators
    - Browser plugin availability
    
    **To test:** Include '_browserProps' object with browser properties.
    **Tip:** Real browsers will have plugins, languages, etc.
    `
  })
  @ApiBody({ type: TestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Headless Browser Guard passed',
    type: BaseResponseDto<{ 
      message: string; 
      browserProps: string;
      detectionResult: string;
    }>
  })
  @ApiForbiddenResponse({ 
    description: 'Headless browser detected - automated tool or bot'
  })
  testHeadless(
    @Body() testDto: TestRequestDto
  ): BaseResponseDto<{ 
    message: string; 
    browserProps: string;
    detectionResult: string;
  }> {
    const data = {
      message: 'Headless Browser Guard passed',
      browserProps: testDto._browserProps ? 'Browser properties received' : 'No browser properties',
      detectionResult: 'Real browser detected',
    };

    return new BaseResponseDto(data);
  }

  /**
   * Rate Limiting 테스트
   */
  @Get('rate-limit')
  @Throttle({ default: { ttl: 10000, limit: 3 } }) // 10초에 3회
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test rate limiting',
    description: `
    Test the rate limiting functionality.
    
    **Limit:** 3 requests per 10 seconds
    **Headers:** Check X-RateLimit-* headers in response
    
    **To test:** Make multiple rapid requests to trigger rate limiting.
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Rate limit test completed',
    type: BaseResponseDto<{ 
      message: string; 
      requestCount: number;
      timeWindow: string;
      remaining: string;
    }>
  })
  @ApiTooManyRequestsResponse({ 
    description: 'Rate limit exceeded - too many requests'
  })
  testRateLimit(): BaseResponseDto<{ 
    message: string; 
    requestCount: number;
    timeWindow: string;
    remaining: string;
  }> {
    const data = {
      message: 'Rate limit test',
      requestCount: Math.floor(Math.random() * 3) + 1,
      timeWindow: '10 seconds',
      remaining: 'Check X-RateLimit-Remaining header',
    };

    return new BaseResponseDto(data);
  }

  /**
   * 모든 가드 조합 테스트
   */
  @Post('all-guards')
  @UseGuards(IpBlacklistGuard, UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 1분에 5회
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test all security guards combined',
    description: `
    Test all security guards working together.
    
    **Applied Guards:**
    1. IP Blacklist Check
    2. User-Agent Validation
    3. Headless Browser Detection
    4. Honeypot Field Check
    5. reCAPTCHA Verification
    6. Rate Limiting (5 requests/minute)
    
    **This is the highest security level available.**
    All guards must pass for the request to succeed.
    `
  })
  @ApiBody({ type: TestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'All security guards passed - maximum security level cleared',
    type: BaseResponseDto<{ 
      message: string;
      guardsPasssed: string[];
      securityLevel: string;
      timestamp: string;
    }>
  })
  @ApiForbiddenResponse({ 
    description: 'One or more security guards failed'
  })
  @ApiTooManyRequestsResponse({ 
    description: 'Rate limit exceeded'
  })
  testAllGuards(
    @Body() testDto: TestRequestDto
  ): BaseResponseDto<{ 
    message: string;
    guardsPasssed: string[];
    securityLevel: string;
    timestamp: string;
  }> {
    this.logger.log('All security guards test passed', {
      hasRecaptcha: !!testDto.recaptchaToken,
      hasBrowserProps: !!testDto._browserProps,
    });

    const data = {
      message: 'All security guards passed successfully',
      guardsPasssed: [
        'IpBlacklistGuard',
        'UserAgentGuard', 
        'HeadlessBrowserGuard',
        'HoneypotGuard',
        'RecaptchaGuard'
      ],
      securityLevel: 'MAXIMUM',
      timestamp: new Date().toISOString(),
    };

    return new BaseResponseDto(data);
  }

  /**
   * 보안 테스트 정보 조회
   */
  @Get('info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get security testing information',
    description: 'Get information about available security tests and how to use them.'
  })
  @ApiResponse({
    status: 200,
    description: 'Security testing information retrieved'
  })
  getTestInfo(): BaseResponseDto<{
    availableTests: Array<{
      endpoint: string;
      guard: string;
      description: string;
      method: string;
      testTips: string[];
    }>;
    generalTips: string[];
  }> {
    const data = {
      availableTests: [
        {
          endpoint: '/test/user-agent',
          guard: 'UserAgentGuard',
          description: 'Tests User-Agent header validation',
          method: 'POST',
          testTips: [
            'Try with curl: curl -H "User-Agent: bot" ...',
            'Try with selenium: curl -H "User-Agent: selenium" ...',
            'Normal browser user agents should pass'
          ]
        },
        {
          endpoint: '/test/ip-blacklist', 
          guard: 'IpBlacklistGuard',
          description: 'Tests IP blacklist protection',
          method: 'POST',
          testTips: [
            'Use admin endpoints to add your IP to blacklist',
            'Then test - should be blocked',
            'Remove from blacklist to restore access'
          ]
        },
        {
          endpoint: '/test/honeypot',
          guard: 'HoneypotGuard', 
          description: 'Tests honeypot field detection',
          method: 'POST',
          testTips: [
            'Include email_confirm field to trigger',
            'Set _timestamp to very recent time',
            'Omit _jsToken to trigger validation'
          ]
        },
        {
          endpoint: '/test/recaptcha',
          guard: 'RecaptchaGuard',
          description: 'Tests reCAPTCHA verification',
          method: 'POST', 
          testTips: [
            'Requires valid reCAPTCHA configuration',
            'Include recaptchaToken in request body',
            'Score must be >= 0.5 to pass'
          ]
        },
        {
          endpoint: '/test/headless',
          guard: 'HeadlessBrowserGuard',
          description: 'Tests headless browser detection',
          method: 'POST',
          testTips: [
            'Include _browserProps with browser info',
            'Real browsers have plugins, languages',
            'Headless browsers often lack these'
          ]
        }
      ],
      generalTips: [
        'Use /test/all-guards to test maximum security',
        'Check response headers for rate limit info',
        'Admin endpoints can help setup test scenarios',
        'Each guard logs security events for monitoring'
      ]
    };

    return new BaseResponseDto(data);
  }
}
