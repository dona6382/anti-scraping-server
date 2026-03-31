import * as os from 'os';

import { Injectable, Inject, Logger } from '@nestjs/common';

import { APP_VERSION } from '../../common/constants/app.constants';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';
import { SecurityEventService } from '../../common/services/security-event.service';
import { ResponseBuilder } from '../../common/utils/response.builder';
import { SystemUtils } from '../../common/utils/system.utils';
import { ICacheService } from '../../core/cache/interfaces';
import { AppConfigService } from '../../core/config/config.service';
import { HealthService } from '../health/health.service';

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

  async getSystemInfo() {
    return ResponseBuilder.success({
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
      application: {
        name: 'Anti-Scraping Server',
        version: APP_VERSION,
        environment: this.configService.nodeEnv,
        port: this.configService.port,
        startedAt: this.startedAt.toISOString(),
      },
      memory: {
        totalMB: SystemUtils.bytesToMB(os.totalmem()),
        freeMB: SystemUtils.bytesToMB(os.freemem()),
        process: {
          heapUsedMB: SystemUtils.bytesToMB(process.memoryUsage().heapUsed),
          heapTotalMB: SystemUtils.bytesToMB(process.memoryUsage().heapTotal),
          rssMB: SystemUtils.bytesToMB(process.memoryUsage().rss),
        },
      },
      cpu: {
        model: os.cpus()[0]?.model,
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
    });
  }

  async getSystemStats() {
    const [ipStats, securityStats] = await Promise.all([
      this.ipBlacklistService.getStatistics(),
      this.securityEventService.getStatistics(),
    ]);

    return ResponseBuilder.success({
      security: { events: securityStats, ipBlacklist: ipStats },
      performance: { uptime: process.uptime(), memoryUsage: process.memoryUsage() },
      cache: { redisConnected: ipStats.redisConnected },
    });
  }

  async getSecurityEvents(params: { page: number; limit: number; severity?: string }) {
    return ResponseBuilder.success(await this.securityEventService.findAll(params));
  }

  async getSystemConfig() {
    return ResponseBuilder.success({
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
    });
  }

  async clearSystemCache() {
    this.logger.warn('System cache clear requested (preserving security data)');

    // 보안 캐시 프리픽스 (삭제하지 않음)
    const securityPrefixes = ['blacklist:', 'threat:', 'auto_block:'];

    // 전체 키 조회
    const allKeys = await this.cacheService.keys('*');

    // 보안 키가 아닌 것만 삭제
    const keysToDelete = allKeys.filter(
      (key) => !securityPrefixes.some((prefix) => key.startsWith(prefix)),
    );

    if (keysToDelete.length > 0) {
      await this.cacheService.deleteMany(keysToDelete);
    }

    return ResponseBuilder.success(
      {
        deleted: keysToDelete.length,
        preserved: allKeys.length - keysToDelete.length,
        securityDataPreserved: true,
      },
      'Application cache cleared (security data preserved)',
    );
  }

  async forceHealthCheck() {
    this.logger.log('Force health check requested');
    return ResponseBuilder.success(await this.healthService.getDetailedHealth());
  }
}
