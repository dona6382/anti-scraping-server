import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipIpBlacklist } from './common/guards/ip-blacklist.guard';
import { SkipUserAgent } from './common/guards/user-agent.guard';
import { SkipHeadlessBrowser } from './common/guards/headless-browser.guard';
import { ResponseBuilder } from './common/utils/response.builder';

@ApiTags('Application')
@Controller()
export class AppController {
  @Get()
  @SkipThrottle()
  @SkipIpBlacklist()
  @SkipUserAgent()
  @SkipHeadlessBrowser()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return ResponseBuilder.success({
      name: 'Anti-Scraping Server',
      version: '2.0.0',
      status: 'running',
      docs: '/api-docs',
      health: '/health',
    });
  }
}
