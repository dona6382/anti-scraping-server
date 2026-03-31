import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { APP_VERSION } from './common/constants/app.constants';
import { SkipBehavioral } from './common/guards/behavioral.guard';
import { SkipChallenge } from './common/guards/challenge.guard';
import { SkipHeadlessBrowser } from './common/guards/headless-browser.guard';
import { SkipIpBlacklist } from './common/guards/ip-blacklist.guard';
import { SkipUserAgent } from './common/guards/user-agent.guard';
import { ResponseBuilder } from './common/utils/response.builder';

@ApiTags('Application')
@Controller()
export class AppController {
  @Get()
  @SkipThrottle()
  @SkipIpBlacklist()
  @SkipUserAgent()
  @SkipHeadlessBrowser()
  @SkipBehavioral()
  @SkipChallenge()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return ResponseBuilder.success({
      name: 'Anti-Scraping Server',
      version: APP_VERSION,
      status: 'running',
      docs: '/api-docs',
      health: '/health',
    });
  }
}
