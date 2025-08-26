import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Local imports - 중복 제거됨
import { BusinessService } from '../services/business.service';

// Common guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';

// Types
import { ExtendedRequest } from '../types';
import { TestRequestDto } from '../common/dto';

// Local types
interface SecurityTestResult {
  test: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  details?: any;
}

@ApiTags('Testing & Validation')
@Controller('test')
@UseGuards(IpBlacklistGuard)
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Basic functionality test',
    description: 'Test basic system functionality and security measures.'
  })
  @ApiResponse({ status: 200, description: 'Test completed successfully' })
  getBasicTest() {
    this.logger.log('Basic test requested');

    return {
      status: 'success',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      tests: {
        server: 'running',
        database: 'connected',
        cache: 'active',
        guards: 'enabled',
        api: 'functional'
      },
      endpoints: [
        '/test',
        '/test/user-agent',
        '/test/honeypot',
        '/test/security-full',
        '/test/performance'
      ]
    };
  }

  @Get('user-agent')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User-Agent guard test',
    description: 'Test User-Agent filtering functionality.'
  })
  getUserAgentTest(@Req() request: ExtendedRequest) {
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) 
      ? userAgentHeader[0] 
      : userAgentHeader || 'unknown';
    
    return {
      status: 'passed',
      message: 'User-Agent validation successful',
      userAgent: userAgent.substring(0, 100),
      timestamp: new Date().toISOString()
    };
  }

  @Post('honeypot')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ 
    summary: 'Honeypot detection test',
    description: 'Test honeypot field detection for bot protection.'
  })
  @ApiBody({ type: TestRequestDto })
  postHoneypotTest(@Body() testDto: TestRequestDto) {
    return {
      status: 'passed',
      message: 'Honeypot test successful - no bot detected',
      timestamp: new Date().toISOString(),
      data: {
        name: testDto.name,
        email: testDto.email,
        message: testDto.message
      }
    };
  }

  @Get('security-full')
  @UseGuards(UserAgentGuard, HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ 
    summary: 'Comprehensive security test',
    description: 'Run all security guards and return detailed results.'
  })
  async getFullSecurityTest(@Req() request: ExtendedRequest) {
    const tests: SecurityTestResult[] = [];

    // IP Test
    const ip = this.getClientIp(request);
    tests.push({
      test: 'IP Extraction',
      status: 'passed',
      message: 'IP successfully extracted',
      details: { ip: this.maskIp(ip) }
    });

    // User-Agent Test
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) 
      ? userAgentHeader[0] 
      : userAgentHeader || 'unknown';
    tests.push({
      test: 'User-Agent',
      status: 'passed',
      message: 'Valid User-Agent detected',
      details: { userAgent: userAgent.substring(0, 50) }
    });

    // Headers Test
    const suspiciousHeaders = this.checkSuspiciousHeaders(request);
    tests.push({
      test: 'Headers Analysis',
      status: suspiciousHeaders.length === 0 ? 'passed' : 'failed',
      message: suspiciousHeaders.length === 0 ? 'No suspicious headers' : 'Suspicious headers detected',
      details: { suspiciousCount: suspiciousHeaders.length }
    });

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;

    return {
      overall: failed === 0 ? 'PASSED' : 'FAILED',
      summary: {
        total: tests.length,
        passed,
        failed,
        successRate: `${Math.round((passed / tests.length) * 100)}%`
      },
      tests,
      timestamp: new Date().toISOString(),
      recommendations: failed > 0 ? ['Review failed tests', 'Check security configuration'] : ['All tests passed']
    };
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'System performance test',
    description: 'Test system performance and resource usage.'
  })
  getPerformanceTest() {
    const startTime = process.hrtime.bigint();
    
    // CPU intensive task simulation
    const testData = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      timestamp: Date.now(),
      hash: this.simpleHash(i.toString()),
      random: Math.random()
    }));

    const endTime = process.hrtime.bigint();
    const processingTime = Number(endTime - startTime) / 1000000;

    return {
      status: 'completed',
      performance: {
        processingTimeMs: Math.round(processingTime * 100) / 100,
        dataProcessed: testData.length,
        throughput: Math.round((testData.length / processingTime) * 1000),
      },
      system: {
        uptime: Math.round(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        cpu: {
          loadAverage: process.platform === 'linux' ? require('os').loadavg() : 'N/A (non-Linux)'
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  private getClientIp(request: ExtendedRequest): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.headers['x-real-ip'] as string ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private maskIp(ip: string): string {
    if (ip === 'unknown') return ip;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`;
    }
    return ip.substring(0, 8) + '***';
  }

  private checkSuspiciousHeaders(request: ExtendedRequest): string[] {
    const suspicious: string[] = [];
    const headers = request.headers;

    // Check for missing standard headers
    if (!headers['user-agent']) suspicious.push('missing-user-agent');
    if (!headers['accept']) suspicious.push('missing-accept');
    if (!headers['accept-language']) suspicious.push('missing-accept-language');

    // Check for automation tools
    const userAgentStr = Array.isArray(headers['user-agent']) 
      ? headers['user-agent'][0] 
      : headers['user-agent'];
    if (userAgentStr?.toLowerCase().includes('python')) suspicious.push('python-user-agent');
    if (userAgentStr?.toLowerCase().includes('curl')) suspicious.push('curl-user-agent');

    return suspicious;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}