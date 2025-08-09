import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../security/security.guard';
import { HealthService } from './health.service';

/**
 * Health Check Controller
 * 시스템 상태를 모니터링하는 엔드포인트 제공
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    const health = await this.healthService.getOverallHealth();
    
    if (!health.healthy) {
      throw new Error('System unhealthy');
    }
    
    return health;
  }

  /**
   * Detailed health check
   */
  @Get('detailed')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }

  /**
   * Liveness probe for Kubernetes
   */
  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return { status: 'alive' };
  }

  /**
   * Readiness probe for Kubernetes
   */
  @Get('ready')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getReadiness() {
    const ready = await this.healthService.isReady();
    
    if (!ready) {
      throw new Error('System not ready');
    }
    
    return { status: 'ready' };
  }
}
