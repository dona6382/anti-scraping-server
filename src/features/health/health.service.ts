import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'os';

import { ICacheService } from '../../core/cache/interfaces';
import { AppConfigService } from '../../core/config/config.service';
import { SystemUtils } from '../../common/utils/system.utils';
import { HEALTH_THRESHOLDS } from '../../common/constants/threshold.constants';

export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Health Service
 * 시스템 상태를 모니터링하는 서비스
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly dataSource: DataSource,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    private readonly configService: AppConfigService,
  ) {}

  async getOverallHealth(): Promise<HealthStatus> {
    const checks = await this.runHealthChecks();
    const healthy = checks.every(check => check.status !== 'unhealthy');

    return {
      healthy,
      timestamp: new Date(),
      uptime: this.getUptime(),
      checks,
    };
  }

  async getDetailedHealth() {
    const health = await this.getOverallHealth();

    return {
      ...health,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: this.getUptime(),
        memory: {
          totalMB: SystemUtils.bytesToMB(os.totalmem()),
          freeMB: SystemUtils.bytesToMB(os.freemem()),
        },
        cpu: {
          model: os.cpus()[0]?.model,
          cores: os.cpus().length,
        },
      },
    };
  }

  async isReady(): Promise<boolean> {
    const checks = await this.runHealthChecks();
    return checks.every(check => check.status !== 'unhealthy');
  }

  private async runHealthChecks(): Promise<HealthCheck[]> {
    return Promise.all([
      this.checkMemory(),
      this.checkCpu(),
      this.checkDatabase(),
      this.checkRedis(),
    ]);
  }

  private checkMemory(): HealthCheck {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;

    let status: HealthCheck['status'] = 'healthy';
    if (heapUsedPercent > HEALTH_THRESHOLDS.MEMORY_UNHEALTHY_PCT) status = 'unhealthy';
    else if (heapUsedPercent > HEALTH_THRESHOLDS.MEMORY_DEGRADED_PCT) status = 'degraded';

    return {
      name: 'memory',
      status,
      metadata: {
        heapUsedMB: SystemUtils.bytesToMB(used.heapUsed),
        heapTotalMB: SystemUtils.bytesToMB(used.heapTotal),
        percentage: Math.round(heapUsedPercent),
      },
    };
  }

  private checkCpu(): HealthCheck {
    const cores = os.cpus().length;
    const loadAvg = os.loadavg();
    const avgLoad = loadAvg[0];

    let status: HealthCheck['status'] = 'healthy';
    if (avgLoad > cores * HEALTH_THRESHOLDS.CPU_UNHEALTHY_FACTOR) status = 'unhealthy';
    else if (avgLoad > cores * HEALTH_THRESHOLDS.CPU_DEGRADED_FACTOR) status = 'degraded';

    return {
      name: 'cpu',
      status,
      metadata: { cores, loadAverage: loadAvg.map(v => Math.round(v * 100) / 100) },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      if (!this.dataSource.isInitialized) {
        return { name: 'database', status: 'unhealthy', message: 'Not initialized' };
      }
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        name: 'database',
        status: responseTime > HEALTH_THRESHOLDS.DB_DEGRADED_MS ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Connection failed',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    if (!this.configService.redisConfig.host) {
      return { name: 'redis', status: 'healthy', message: 'Not configured (in-memory mode)' };
    }

    const start = Date.now();
    try {
      const testKey = '__health_check__';
      await this.cacheService.set(testKey, 'ok', 5);
      const value = await this.cacheService.get<string>(testKey);
      await this.cacheService.delete(testKey);
      const responseTime = Date.now() - start;

      if (value !== 'ok') {
        return { name: 'redis', status: 'unhealthy', responseTime, message: 'Read/write mismatch' };
      }

      return {
        name: 'redis',
        status: responseTime > HEALTH_THRESHOLDS.REDIS_DEGRADED_MS ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: 'Connection failed',
      };
    }
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
