import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipIpBlacklist } from './common/guards/ip-blacklist.guard';

/**
 * App Controller
 * 루트 엔드포인트
 */
@ApiTags('Application')
@Controller()
export class AppController {
  @Get()
  @SkipThrottle()
  @SkipIpBlacklist()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return {
      name: 'Anti-Scraping Server',
      version: '2.0.0',
      status: 'running',
      docs: '/api-docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };
  }
}
