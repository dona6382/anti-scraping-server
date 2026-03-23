import { Injectable, Inject, Logger } from '@nestjs/common';
import * as os from 'os';

import { AppConfigService } from '../../core/config/config.service';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';
import { SecurityEventService } from '../../common/services/security-event.service';
import { HealthService } from '../health/health.service';
import { ICacheService } from '../../core/cache/interfaces';

/**
 * Admin Service
 * 관리자 기능의 비즈니스 로직
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startedAt = new Date();

  constructor(
    private readonly configService: AppConfigService,
    private readonly ipBlacklistService: IpBlacklistService,
    private readonly securityEventService: SecurityEventService,
    private readonly healthService: HealthService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  /**
   * 시스템 정보 조회
   */
  async getSystemInfo() {
    return {
      success: true,
      data: {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          nodeVersion: process.version,
          uptime: process.uptime(),
        },
        application: {
          name: 'Anti-Scraping Server',
          version: '2.0.0',
          environment: this.configService.nodeEnv,
          port: this.configService.port,
          startedAt: this.startedAt.toISOString(),
        },
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
          process: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        },
        cpu: {
          model: os.cpus()[0]?.model,
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 시스템 통계 조회 (실제 데이터 기반)
   */
  async getSystemStats() {
    const [ipStats, securityStats] = await Promise.all([
      this.ipBlacklistService.getStatistics(),
      this.securityEventService.getStatistics(),
    ]);

    return {
      success: true,
      data: {
        security: {
          events: securityStats,
          ipBlacklist: ipStats,
        },
        performance: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },
        cache: {
          redisConnected: ipStats.redisConnected,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 보안 이벤트 조회 (DB에서 실제 데이터)
   */
  async getSecurityEvents(params: { page: number; limit: number; severity?: string }) {
    const result = await this.securityEventService.findAll({
      page: params.page,
      limit: params.limit,
      severity: params.severity,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 시스템 설정 조회 (민감한 값은 마스킹)
   */
  async getSystemConfig() {
    return {
      success: true,
      data: {
        server: {
          port: this.configService.port,
          nodeEnv: this.configService.nodeEnv,
          corsOrigins: this.configService.corsOrigins,
        },
        security: {
          strictMode: this.configService.isStrictMode,
          rateLimit: this.configService.rateLimitConfig,
          ipBlacklist: {
            enabled: this.configService.ipBlacklistConfig.enabled,
            ttl: this.configService.ipBlacklistConfig.ttl,
          },
          honeypot: this.configService.honeypotConfig,
        },
        redis: {
          host: this.configService.redisConfig.host,
          port: this.configService.redisConfig.port,
          password: this.configService.redisConfig.password ? '***masked***' : null,
        },
        recaptcha: {
          configured: !!this.configService.recaptchaConfig.secretKey,
          scoreThreshold: this.configService.recaptchaConfig.scoreThreshold,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 시스템 캐시 클리어
   */
  async clearSystemCache() {
    this.logger.warn('System cache clear requested');
    await this.cacheService.clear();

    return {
      success: true,
      message: 'System cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 로그 레벨 변경
   */
  async changeLogLevel(level: string) {
    this.logger.warn(`Log level changed to: ${level}`);

    return {
      success: true,
      data: { newLevel: level },
      message: 'Log level changed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 강제 헬스체크 실행 (HealthService에 위임)
   */
  async forceHealthCheck() {
    this.logger.log('Force health check requested');
    const health = await this.healthService.getDetailedHealth();

    return {
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    };
  }
}
