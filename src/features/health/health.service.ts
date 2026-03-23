import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'os';

import { ICacheService } from '../../core/cache/interfaces';

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
  metadata?: Record<string, any>;
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
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
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
    if (heapUsedPercent > 95) status = 'unhealthy';
    else if (heapUsedPercent > 85) status = 'degraded';

    return {
      name: 'memory',
      status,
      metadata: {
        heapUsedMB: Math.round(used.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(used.heapTotal / 1024 / 1024),
        percentage: Math.round(heapUsedPercent),
      },
    };
  }

  private checkCpu(): HealthCheck {
    const cores = os.cpus().length;
    const loadAvg = os.loadavg();
    const avgLoad = loadAvg[0];

    let status: HealthCheck['status'] = 'healthy';
    if (avgLoad > cores * 0.9) status = 'unhealthy';
    else if (avgLoad > cores * 0.7) status = 'degraded';

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
        status: responseTime > 1000 ? 'degraded' : 'healthy',
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
    if (!process.env.REDIS_HOST) {
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
        status: responseTime > 500 ? 'degraded' : 'healthy',
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
