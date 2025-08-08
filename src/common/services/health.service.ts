import { Injectable } from '@nestjs/common';
import { IpBlacklistService } from './ip-blacklist.service';

/**
 * Health check service
 */
@Injectable()
export class HealthService {
  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * Get overall system health
   */
  async getHealth(): Promise<any> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
    ]);

    const [database, redis, memory] = checks.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { status: 'unhealthy', error: (result as any).reason },
    );

    const isHealthy = [database, redis, memory].every((check) => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database,
        redis,
        memory,
      },
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<any> {
    // Implement actual database check here
    return {
      status: 'healthy',
      responseTime: 5,
    };
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<any> {
    try {
      const stats = await this.ipBlacklistService.getStatistics();
      return {
        status: stats.redisConnected ? 'healthy' : 'unhealthy',
        connected: stats.redisConnected,
        blacklisted: stats.totalBlacklisted,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<any> {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;

    return {
      status: heapUsedPercent < 90 ? 'healthy' : 'warning',
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
      percentage: heapUsedPercent.toFixed(2) + '%',
    };
  }
}
