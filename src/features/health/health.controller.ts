import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health.service';
import { SkipIpBlacklist } from '../../common/guards/ip-blacklist.guard';

/**
 * Health Check Controller
 * 시스템 상태를 모니터링하는 엔드포인트 제공
 * IP 차단/Rate Limiting 제외 (모니터링 프로브용)
 */
@ApiTags('Health')
@Controller('health')
@SkipIpBlacklist()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  async getHealth() {
    const health = await this.healthService.getOverallHealth();
    
    return {
      status: health.healthy ? 'ok' : 'error',
      timestamp: health.timestamp,
      uptime: health.uptime,
      healthy: health.healthy,
      checks: health.checks
    };
  }

  /**
   * Detailed health check
   */
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detailed health check' })
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }

  /**
   * Liveness probe for Kubernetes
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  getLiveness() {
    return { status: 'alive' };
  }

  /**
   * Readiness probe for Kubernetes
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  async getReadiness() {
    const ready = await this.healthService.isReady();
    
    if (!ready) {
      throw new ServiceUnavailableException('System not ready');
    }
    
    return { status: 'ready' };
  }
}
