import { Controller, Get, Req, Logger, HttpCode, HttpStatus } from '@nestjs/common';

import { SkipChallenge } from '../../common/guards/challenge.guard';
import { SkipUserAgent } from '../../common/guards/user-agent.guard';
import { SkipHeadlessBrowser } from '../../common/guards/headless-browser.guard';
import { SkipBehavioral } from '../../common/guards/behavioral.guard';
import { SkipIpBlacklist } from '../../common/guards/ip-blacklist.guard';
import { SecurityEventService } from '../../common/services/security-event.service';
import { ThreatScoreService } from '../../common/services/threat-score.service';
import { RequestUtils } from '../../common/utils/request.utils';
import { ResponseBuilder } from '../../common/utils/response.builder';
import { ExtendedRequest } from '../../core/types';

/**
 * Honeypot Controller
 *
 * 봇만 접근하는 함정 엔드포인트.
 * 실제 API와 동일한 ResponseBuilder 포맷으로 응답 — 봇이 구별 불가.
 *
 * 모든 보안 Guard Skip — 봇이 여기까지 도달해야 함정이 작동.
 * Swagger에 등록하지 않음 — @ApiTags 없음.
 */
@Controller()
@SkipChallenge()
@SkipUserAgent()
@SkipHeadlessBrowser()
@SkipBehavioral()
@SkipIpBlacklist()
export class HoneypotController {
  private readonly logger = new Logger(HoneypotController.name);

  constructor(
    private readonly securityEventService: SecurityEventService,
    private readonly threatScoreService: ThreatScoreService,
  ) {}

  @Get('api/internal/users')
  @HttpCode(HttpStatus.OK)
  async getInternalUsers(@Req() req: ExtendedRequest) {
    await this.triggerHoneypot(req, 'api/internal/users');

    return ResponseBuilder.success([
      { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', active: true },
      { id: 2, username: 'john.doe', email: 'john@example.com', role: 'user', active: true },
      { id: 3, username: 'jane.smith', email: 'jane@example.com', role: 'editor', active: false },
      { id: 4, username: 'service_bot', email: 'bot@example.com', role: 'service', active: true },
      { id: 5, username: 'test_user', email: 'test@example.com', role: 'user', active: true },
    ]);
  }

  @Get('api/internal/config')
  @HttpCode(HttpStatus.OK)
  async getInternalConfig(@Req() req: ExtendedRequest) {
    await this.triggerHoneypot(req, 'api/internal/config');

    return ResponseBuilder.success({
      appName: 'internal-api-service',
      version: '1.2.0',
      environment: 'production',
      features: {
        rateLimit: true,
        caching: true,
        logging: true,
        notifications: false,
      },
      limits: {
        maxRequestsPerMinute: 100,
        maxUploadSizeMb: 10,
        sessionTimeoutMinutes: 30,
      },
      database: {
        host: 'db.internal.example.com',
        port: 5432,
        pool: { min: 5, max: 20 },
      },
    });
  }

  @Get('api/v2/data')
  @HttpCode(HttpStatus.OK)
  async getV2Data(@Req() req: ExtendedRequest) {
    await this.triggerHoneypot(req, 'api/v2/data');

    return ResponseBuilder.success({
      items: [
        { id: 'a1b2c3', name: 'Premium Dataset', type: 'analytics', records: 15420 },
        { id: 'd4e5f6', name: 'User Metrics', type: 'metrics', records: 8930 },
        { id: 'g7h8i9', name: 'System Logs', type: 'logs', records: 234100 },
      ],
      pagination: { page: 1, perPage: 20, total: 3, totalPages: 1 },
    });
  }

  private async triggerHoneypot(req: ExtendedRequest, endpoint: string): Promise<void> {
    const ip = RequestUtils.extractClientIp(req);
    const userAgent = RequestUtils.extractUserAgent(req);

    this.logger.warn(
      `Honeypot triggered: ${endpoint} from IP ${RequestUtils.hashIp(ip, 'log')}`,
    );

    await Promise.all([
      this.securityEventService.log({
        eventType: 'HONEYPOT_TRIGGERED',
        severity: 'HIGH',
        ip,
        userAgent,
        endpoint,
        method: 'GET',
        description: `Honeypot endpoint accessed: ${endpoint}`,
        eventData: {
          trap: endpoint,
          headers: {
            accept: req.headers['accept'],
            referer: req.headers['referer'],
            origin: req.headers['origin'],
          },
        },
      }),
      this.threatScoreService.recordViolation(ip, 'HONEYPOT_TRIGGERED', 'HIGH'),
    ]);
  }
}
