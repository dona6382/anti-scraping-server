import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../security/security.guard';
import { HealthService, HealthCheck } from './health.service';

/**
 * Health Check Controller
 * 시스템 상태를 모니터링하는 엔드포인트 제공
 */
// @ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check
   */
  /*
  @ApiOperation({
    summary: '기본 헬스 체크',
    description: '시스템의 기본적인 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '시스템 정상',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 3600 }
      }
    }
  })
  @ApiResponse({ status: 500, description: '시스템 비정상' })
  */
  @Get()
  @Public()
  async getHealth(): Promise<{
    status: string;
    timestamp: Date;
    uptime: number;
    healthy: boolean;
    checks: HealthCheck[];
  }> {
    const health = await this.healthService.getOverallHealth();
    
    // unhealthy여도 200 응답으로 상태 정보 제공
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
