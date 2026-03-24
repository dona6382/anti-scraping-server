import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipIpBlacklist } from './common/guards/ip-blacklist.guard';
import { ResponseBuilder } from './common/utils/response.builder';

@ApiTags('Application')
@Controller()
export class AppController {
  @Get()
  @SkipThrottle()
  @SkipIpBlacklist()
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
