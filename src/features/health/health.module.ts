import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Health Feature Module
 * 
 * 시스템 상태 모니터링 기능:
 * - Health checks
 * - System metrics
 * - Kubernetes probes
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
