import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// Services
import { AppService } from './app.service';
import { IpBlacklistService, BlacklistEntry } from './common/services/ip-blacklist.service';
import { HealthService } from './common/services/health.service';

// Guards
import { UserAgentGuard } from './common/guards/user-agent.guard';
import { IpBlacklistGuard } from './common/guards/ip-blacklist.guard';
import { HoneypotGuard } from './common/guards/honeypot.guard';
import { RecaptchaGuard } from './common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from './common/guards/headless-browser.guard';

// Utils and Types
import { SecurityUtil } from './common/utils/security.utils';
import { BlockReason } from './common/types/security.types';

/**
 * Main Application Controller (리팩토링)
 */
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly ipBlacklistService: IpBlacklistService,
    private readonly healthService: HealthService,
  ) {}

  // ============================================
  // Public Endpoints
  // ============================================

  @Get()
  @SkipThrottle()
  getHello(): any {
    return this.appService.getHello();
  }

  @Get('api/public-data')
  @HttpCode(HttpStatus.OK)
  getPublicData() {
    this.logger.log('Public data requested');

    return {
      status: 'success',
      data: {
        message: 'This is public data with basic rate limiting',
        timestamp: new Date().toISOString(),
        items: this.generateSampleItems(3),
      },
    };
  }

  // ============================================
  // Protected Endpoints
  // ============================================

  @Get('api/protected-data')
  @UseGuards(IpBlacklistGuard, UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  getProtectedData() {
    this.logger.log('Protected data accessed successfully');

    return {
      status: 'success',
      data: {
        message: 'This is highly protected data',
        timestamp: new Date().toISOString(),
        sensitive: {
          secret: 'Protected by multiple anti-scraping measures',
          value: this.generateRandomValue(),
        },
      },
    };
  }

  @Post('api/contact')
  @UseGuards(IpBlacklistGuard, UserAgentGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  async submitContact(@Body() body: any) {
    const sanitizedData = SecurityUtil.sanitizeBody(body);

    this.logger.log('Contact form submitted', {
      email: sanitizedData.email,
      name: sanitizedData.name,
    });

    return {
      status: 'success',
      message: 'Contact form submitted successfully',
      data: sanitizedData,
      id: this.generateId('CONTACT'),
    };
  }

  @Post('api/critical-action')
  @UseGuards(IpBlacklistGuard, UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async performCriticalAction(@Body() body: any) {
    const sanitizedData = SecurityUtil.sanitizeBody(body);

    this.logger.warn('Critical action performed', {
      action: sanitizedData.action,
    });

    return {
      status: 'success',
      message: 'Critical action completed',
      id: this.generateId('ACTION'),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api/search/:query')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 30000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  searchData(@Param('query') query: string) {
    this.logger.log(`Search query: ${query}`);

    return {
      status: 'success',
      query,
      results: this.generateSearchResults(query, 3),
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // Admin Endpoints
  // ============================================

  @Get('admin/blacklist/stats')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getBlacklistStats() {
    const stats = await this.ipBlacklistService.getStatistics();

    return {
      status: 'success',
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/blacklist/ips')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getBlacklistedIps() {
    const ips = await this.ipBlacklistService.getAllBlacklistedIps();

    return {
      status: 'success',
      count: ips.length,
      ips,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/blacklist/ip')
  @SkipThrottle()
  @HttpCode(HttpStatus.CREATED)
  async addIpToBlacklist(@Body() body: { ip: string; reason?: string; ttl?: number }) {
    await this.ipBlacklistService.blacklistIp(body.ip, body.reason || BlockReason.MANUAL, body.ttl);

    return {
      status: 'success',
      message: `IP ${body.ip} has been blacklisted`,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('admin/blacklist/ip/:ip')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async removeIpFromBlacklist(@Param('ip') ip: string) {
    await this.ipBlacklistService.removeFromBlacklist(ip);

    return {
      status: 'success',
      message: `IP ${ip} has been removed from blacklist`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/blacklist/ip/:ip')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getIpInfo(@Param('ip') ip: string) {
    const info = await this.ipBlacklistService.getIpInfo(ip);

    return {
      status: 'success',
      ip,
      info,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // System Health Endpoints
  // ============================================

  @Get('health')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getHealth() {
  const health = await this.healthService.getHealth();
  return health;
  }

  @Get('health/redis')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getRedisHealth() {
  const stats = await this.ipBlacklistService.getStatistics();
  
  if (!stats.redisConnected) {
  throw new HttpException(
  {
    status: 'unhealthy',
    message: 'Redis connection is not healthy',
      details: stats,
      },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    
    return {
      status: 'healthy',
    redis: {
      connected: stats.redisConnected,
      stats,
      timestamp: new Date().toISOString(),
    },
  };
  }

  // ============================================
  // Test Endpoints
  // ============================================

  @Post('test/user-agent')
  @UseGuards(UserAgentGuard)
  @HttpCode(HttpStatus.OK)
  testUserAgent() {
    return {
      status: 'success',
      message: 'User-Agent Guard passed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/ip-blacklist')
  @UseGuards(IpBlacklistGuard)
  @HttpCode(HttpStatus.OK)
  async testIpBlacklist() {
    return {
      status: 'success',
      message: 'IP Blacklist Guard passed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/honeypot')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  testHoneypot(@Body() body: any) {
    const sanitizedData = SecurityUtil.sanitizeBody(body);

    return {
      status: 'success',
      message: 'Honeypot Guard passed',
      receivedData: sanitizedData,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/recaptcha')
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  testRecaptcha(@Body() body: any) {
    return {
      status: 'success',
      message: 'reCAPTCHA Guard passed',
      token: body.recaptchaToken ? 'received' : 'missing',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/headless')
  @UseGuards(HeadlessBrowserGuard)
  @HttpCode(HttpStatus.OK)
  testHeadless(@Body() body: any) {
    return {
      status: 'success',
      message: 'Headless Browser Guard passed',
      browserProps: body._browserProps ? 'received' : 'missing',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test/rate-limit')
  @Throttle({ default: { ttl: 10000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  testRateLimit() {
    return {
      status: 'success',
      message: 'Rate limit test',
      remaining: 'Check headers for X-RateLimit-Remaining',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Generate sample items for testing
   */
  private generateSampleItems(count: number): any[] {
    const items = [];
    for (let i = 1; i <= count; i++) {
      items.push({
        id: i,
        name: `Item ${i}`,
        value: Math.floor(Math.random() * 100),
      });
    }
    return items;
  }

  /**
   * Generate search results
   */
  private generateSearchResults(query: string, count: number): any[] {
    const results = [];
    for (let i = 1; i <= count; i++) {
      results.push({
        id: i,
        title: `Result for "${query}" #${i}`,
        score: Math.random(),
        url: `/result/${i}`,
      });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate random value
   */
  private generateRandomValue(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
}
