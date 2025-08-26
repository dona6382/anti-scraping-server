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
} from '@nestjs/swagger';
import { Request } from 'express';

import { TestingService } from './testing.service';
import { UserAgentGuard } from '../../shared/guards';

/**
 * Testing Controller
 * 보안 기능 테스트를 위한 컨트롤러
 */
@ApiTags('Testing')
@Controller('test')
export class TestingController {
  private readonly logger = new Logger(TestingController.name);

  constructor(private readonly testingService: TestingService) {}

  /**
   * 기본 테스트 엔드포인트
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Basic test endpoint',
    description: 'Test basic functionality without any guards.'
  })
  @ApiResponse({ status: 200, description: 'Test successful' })
  async basicTest(@Req() request: Request) {
    this.logger.log('Basic test endpoint accessed');
    return await this.testingService.performBasicTest(request);
  }

  /**
   * User-Agent 가드 테스트
   */
  @Get('user-agent')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test User-Agent guard',
    description: 'Test endpoint protected by User-Agent validation.'
  })
  @ApiResponse({ status: 200, description: 'User-Agent validation passed' })
  @ApiResponse({ status: 403, description: 'Invalid User-Agent blocked' })
  async testUserAgent(@Req() request: Request) {
    this.logger.log('User-Agent guard test accessed');
    return await this.testingService.testUserAgentGuard(request);
  }

  /**
   * 허니팟 테스트
   */
  @Post('honeypot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test honeypot detection',
    description: 'Test endpoint with honeypot field. Bots will typically fill hidden fields.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        message: { type: 'string', example: 'Test message' },
        email_confirm: { type: 'string', example: '' }, // Honeypot field
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Honeypot test completed' })
  @ApiResponse({ status: 403, description: 'Honeypot triggered - bot detected' })
  async testHoneypot(@Body() body: any, @Req() request: Request) {
    this.logger.log('Honeypot test endpoint accessed');
    return await this.testingService.testHoneypot(body, request);
  }

  /**
   * 보안 종합 테스트
   */
  @Get('security-full')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Comprehensive security test',
    description: 'Test endpoint with multiple security layers applied.'
  })
  @ApiResponse({ status: 200, description: 'All security checks passed' })
  @ApiResponse({ status: 403, description: 'Security check failed' })
  async testSecurityFull(@Req() request: Request) {
    this.logger.log('Full security test accessed');
    return await this.testingService.performFullSecurityTest(request);
  }

  /**
   * 캐시 시스템 테스트
   */
  @Get('cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test cache system',
    description: 'Test Redis/Memory cache functionality.'
  })
  @ApiResponse({ status: 200, description: 'Cache test completed' })
  async testCache() {
    this.logger.log('Cache test accessed');
    return await this.testingService.testCacheSystem();
  }

  /**
   * 설정 시스템 테스트
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test configuration system',
    description: 'Test centralized configuration management.'
  })
  @ApiResponse({ status: 200, description: 'Configuration test completed' })
  async testConfig() {
    this.logger.log('Config test accessed');
    return await this.testingService.testConfigurationSystem();
  }

  /**
   * 에러 처리 테스트
   */
  @Get('error/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test error handling',
    description: 'Test global exception filter with different error types.'
  })
  @ApiResponse({ status: 200, description: 'Error test triggered' })
  async testError(@Req() request: Request) {
    this.logger.log('Error handling test accessed');
    return await this.testingService.testErrorHandling(request);
  }

  /**
   * 성능 테스트
   */
  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Performance test',
    description: 'Test system performance and response times.'
  })
  @ApiResponse({ status: 200, description: 'Performance test completed' })
  async testPerformance() {
    this.logger.log('Performance test accessed');
    return await this.testingService.performPerformanceTest();
  }
}
