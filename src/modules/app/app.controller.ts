import { Controller, Get } from '@nestjs/common';
import { Public } from '../security/security.guard';

/**
 * Root Application Controller (Refactored)
 * 최소한의 책임만 가지는 루트 컨트롤러
 */
@Controller()
export class AppController {
  
  /**
   * Root endpoint
   */
  @Get()
  @Public()
  getRoot() {
    return {
      name: 'Anti-Scraping Server',
      version: '2.0.0',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        api: '/api/v1',
        admin: '/admin',
        docs: '/docs',
      },
    };
  }

  /**
   * API Information
   */
  @Get('info')
  @Public()
  getInfo() {
    return {
      environment: process.env.NODE_ENV || 'development',
      features: {
        ipBlacklist: true,
        userAgentFiltering: true,
        rateLimiting: true,
        honeypot: true,
        headlessDetection: true,
        recaptcha: process.env.RECAPTCHA_SECRET_KEY ? true : false,
      },
      security: {
        strictMode: process.env.SECURITY_STRICT_MODE === 'true',
        rateLimit: {
          ttl: process.env.THROTTLE_TTL || '10',
          limit: process.env.THROTTLE_LIMIT || '20',
        },
      },
    };
  }
}
