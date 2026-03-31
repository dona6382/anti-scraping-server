import { Controller, Get, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ResponseBuilder } from '../../common/utils/response.builder';
import { ExtendedRequest } from '../../core/types';

import { TestActionDto } from './dto/test-action.dto';
import { TestingService, SecurityTestResults } from './testing.service';

@ApiTags('Testing')
@Controller('test')
export class TestingController {
  constructor(private readonly testingService: TestingService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Basic functionality test',
    description: 'Test basic system functionality and security measures.',
  })
  @ApiResponse({ status: 200, description: 'Test completed successfully' })
  getBasicTest() {
    return ResponseBuilder.success(
      {
        server: 'running',
        api: 'functional',
        guards: 'active',
      },
      'Basic test passed',
    );
  }

  @Get('security-full')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Comprehensive security test',
    description: 'Run all security tests and return detailed results.',
  })
  @ApiResponse({ status: 200, description: 'Security test results' })
  async getSecurityTest(@Req() request: ExtendedRequest): Promise<SecurityTestResults> {
    return this.testingService.runSecurityTests(request);
  }

  @Post('action')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Test form submission',
    description: 'Test form submission with security validation.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async postTestAction(@Body() data: TestActionDto) {
    return this.testingService.performTestAction(data);
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Performance test' })
  getPerformanceTest() {
    const startTime = process.hrtime.bigint();

    // Simulate some processing
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      timestamp: Date.now(),
      random: Math.random(),
    }));

    const endTime = process.hrtime.bigint();
    const processingTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    return ResponseBuilder.success({
      processingTimeMs: processingTime,
      dataSize: testData.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    });
  }
}
