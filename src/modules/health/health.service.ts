import { Injectable, Logger } from '@nestjs/common';

/**
 * Health Status Interface
 */
export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  uptime: number;
  checks: HealthCheck[];
}

/**
 * Individual Health Check
 */
interface HealthCheck {
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

  /**
   * Get overall health status
   */
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

  /**
   * Get detailed health information
   */
  async getDetailedHealth(): Promise<any> {
    const health = await this.getOverallHealth();
    const metrics = this.getSystemMetrics();
    
    return {
      ...health,
      system: metrics,
      dependencies: await this.checkDependencies(),
    };
  }

  /**
   * Check if system is ready
   */
  async isReady(): Promise<boolean> {
    const checks = await this.runHealthChecks();
    return checks.every(check => check.status !== 'unhealthy');
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    
    // Memory check
    checks.push(this.checkMemory());
    
    // CPU check
    checks.push(this.checkCpu());
    
    // Database check (if applicable)
    checks.push(await this.checkDatabase());
    
    // Redis check (if applicable)
    checks.push(await this.checkRedis());
    
    return checks;
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheck {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapUsedPercent > 90) {
      status = 'unhealthy';
    } else if (heapUsedPercent > 75) {
      status = 'degraded';
    }
    
    return {
      name: 'memory',
      status,
      metadata: {
        heapUsed: Math.round(used.heapUsed / 1024 / 1024),
        heapTotal: Math.round(used.heapTotal / 1024 / 1024),
        percentage: heapUsedPercent.toFixed(2),
      },
    };
  }

  /**
   * Check CPU usage
   */
  private checkCpu(): HealthCheck {
    const cpus = require('os').cpus();
    const loadAvg = require('os').loadavg();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const avgLoad = loadAvg[0];
    
    if (avgLoad > cpus.length * 0.9) {
      status = 'unhealthy';
    } else if (avgLoad > cpus.length * 0.7) {
      status = 'degraded';
    }
    
    return {
      name: 'cpu',
      status,
      metadata: {
        cores: cpus.length,
        loadAverage: loadAvg,
      },
    };
  }

  /**
   * Check database connection
   */
  private async checkDatabase(): Promise<HealthCheck> {
    // Placeholder - implement actual database check if needed
    return {
      name: 'database',
      status: 'healthy',
      message: 'No database configured',
    };
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<HealthCheck> {
    // Check if Redis is configured
    const redisHost = process.env.REDIS_HOST;
    
    if (!redisHost) {
      return {
        name: 'redis',
        status: 'healthy',
        message: 'Redis not configured (using memory cache)',
      };
    }
    
    // TODO: Implement actual Redis health check
    return {
      name: 'redis',
      status: 'healthy',
      message: 'Redis connection check not implemented',
    };
  }

  /**
   * Check external dependencies
   */
  private async checkDependencies(): Promise<Record<string, any>> {
    return {
      redis: {
        configured: !!process.env.REDIS_HOST,
        host: process.env.REDIS_HOST || 'not configured',
      },
      recaptcha: {
        configured: !!process.env.RECAPTCHA_SECRET_KEY,
      },
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): Record<string, any> {
    const os = require('os');
    
    return {
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
    };
  }

  /**
   * Get system uptime
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
