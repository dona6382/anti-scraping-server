import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';

import { SecurityEvent } from '../../core/database/entities';
import { PaginationUtils } from '../utils/pagination.utils';
import { RequestUtils } from '../utils/request.utils';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { IpBlacklistService } from './ip-blacklist.service';
import { ThreatScoreService } from './threat-score.service';
import { RealtimeGateway } from '../../features/realtime/realtime.gateway';

type SecurityEventType =
  | 'IP_BLOCKED'
  | 'IP_UNBLOCKED'
  | 'BOT_DETECTED'
  | 'RATE_LIMITED'
  | 'HONEYPOT_TRIGGERED'
  | 'USER_AGENT_BLOCKED'
  | 'HEADLESS_BROWSER_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'ADMIN_ACTION'
  | 'SYSTEM_ALERT'
  | 'AUTO_BLOCKED';

type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface LogSecurityEventDto {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  description: string;
  eventData?: Record<string, unknown>;
  actions?: {
    blocked: boolean;
    notified: boolean;
    escalated: boolean;
    autoResolved: boolean;
  };
}

/**
 * Auto-Block 정책
 * 위반 횟수에 따른 단계별 차단
 */
const AUTO_BLOCK_POLICY = {
  WINDOW_MS: 15 * 60 * 1000,      // 15분 윈도우
  THRESHOLDS: [
    { violations: 10, blockTtl: 1800 },    // 10회 → 30분
    { violations: 20, blockTtl: 3600 },    // 20회 → 1시간
    { violations: 50, blockTtl: 86400 },   // 50회 → 24시간
  ],
} as const;

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject(forwardRef(() => IpBlacklistService))
    private readonly ipBlacklistService: IpBlacklistService,
    private readonly threatScoreService: ThreatScoreService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * 보안 이벤트 기록 + 자동 차단 체크
   */
  async log(dto: LogSecurityEventDto): Promise<void> {
    try {
      const event = this.securityEventRepository.create({
        eventType: dto.eventType,
        severity: dto.severity,
        ip: dto.ip,
        userAgent: dto.userAgent?.substring(0, 500),
        endpoint: dto.endpoint?.substring(0, 500),
        method: dto.method,
        description: dto.description,
        eventData: dto.eventData,
        actions: dto.actions ?? {
          blocked: true,
          notified: false,
          escalated: false,
          autoResolved: false,
        },
      });

      this.securityEventRepository.save(event).catch((err) => {
        this.logger.error(`Failed to save security event: ${err.message}`);
      });

      // Broadcast to WebSocket clients
      this.realtimeGateway?.broadcastSecurityEvent({
        eventType: dto.eventType,
        severity: dto.severity,
        ip: dto.ip ? RequestUtils.hashIp(dto.ip, 'ws') : undefined,
        description: dto.description,
        timestamp: new Date().toISOString(),
      });

      // Update threat score
      if (dto.ip && dto.severity) {
        this.threatScoreService.recordViolation(dto.ip, dto.eventType, dto.severity).catch(err => this.logger.error('Failed to record violation', err?.message));
      }

      // 자동 차단 체크 (IP가 있고, 이미 차단 이벤트가 아닌 경우)
      if (dto.ip && dto.eventType !== 'IP_BLOCKED' && dto.eventType !== 'AUTO_BLOCKED') {
        this.checkAutoBlock(dto.ip, dto.eventType).catch((err) => {
          this.logger.error(`Auto-block check failed: ${err.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create security event: ${error}`);
    }
  }

  /**
   * 자동 차단 체크
   * 윈도우 내 위반 횟수를 카운트하여 threshold 초과 시 자동 차단
   */
  private async checkAutoBlock(ip: string, eventType: string): Promise<void> {
    const key = `auto_block:${RequestUtils.normalizeIp(ip)}`;

    try {
      const current = await this.cacheService.get<number>(key) ?? 0;
      const newCount = current + 1;

      const windowSeconds = AUTO_BLOCK_POLICY.WINDOW_MS / 1000;
      await this.cacheService.set(key, newCount, windowSeconds);

      // threshold 체크 (높은 것부터)
      for (const threshold of [...AUTO_BLOCK_POLICY.THRESHOLDS].reverse()) {
        if (newCount >= threshold.violations) {
          const alreadyBlocked = await this.ipBlacklistService.isBlocked(ip);

          if (!alreadyBlocked) {
            // IpBlacklistService를 통해 정상 차단 (캐시 키 일관성 보장)
            await this.ipBlacklistService.blockIp(ip, 'SUSPICIOUS_BEHAVIOR', threshold.blockTtl);

            this.logger.warn(
              `Auto-blocked IP ${RequestUtils.hashIp(ip, 'log')}: ${newCount} violations → ${threshold.blockTtl}s ban`,
            );

            // Broadcast auto-block to WebSocket clients
            this.realtimeGateway?.broadcastAutoBlock({
              ip: RequestUtils.hashIp(ip, 'ws'),
              reason: `${newCount} violations (${eventType})`,
              ttl: threshold.blockTtl,
              violations: newCount,
              timestamp: new Date().toISOString(),
            });

            // 자동 차단 이벤트 DB 기록 (AUTO_BLOCKED 타입으로 재귀 방지)
            const autoBlockEvent = this.securityEventRepository.create({
              eventType: 'AUTO_BLOCKED',
              severity: 'HIGH',
              ip,
              description: `Auto-blocked after ${newCount} violations (${eventType}). TTL: ${threshold.blockTtl}s`,
              actions: { blocked: true, notified: false, escalated: false, autoResolved: false },
            });
            this.securityEventRepository.save(autoBlockEvent).catch(err => this.logger.error('Failed to save auto-block event', err?.message));
          }
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Auto-block check error: ${error}`);
    }
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    severity?: string;
    eventType?: string;
  }) {
    const { page, limit, skip } = PaginationUtils.parse(options.page, options.limit);

    const where: Record<string, unknown> = {};
    if (options.severity) where.severity = options.severity;
    if (options.eventType) where.eventType = options.eventType;

    const [events, total] = await this.securityEventRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: events,
      pagination: PaginationUtils.meta(page, limit, total),
    };
  }

  async getStatistics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, last24hCount, last7dCount] = await Promise.all([
      this.securityEventRepository.count(),
      this.securityEventRepository.count({
        where: { createdAt: MoreThanOrEqual(last24h) },
      }),
      this.securityEventRepository.count({
        where: { createdAt: MoreThanOrEqual(last7d) },
      }),
    ]);

    const byType = await this.securityEventRepository
      .createQueryBuilder('event')
      .select('event.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.eventType')
      .getRawMany();

    const bySeverity = await this.securityEventRepository
      .createQueryBuilder('event')
      .select('event.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.severity')
      .getRawMany();

    return {
      total,
      last24h: last24hCount,
      last7d: last7dCount,
      byType: byType.reduce(
        (acc, row) => ({ ...acc, [row.eventType]: parseInt(row.count) }),
        {},
      ),
      bySeverity: bySeverity.reduce(
        (acc, row) => ({ ...acc, [row.severity]: parseInt(row.count) }),
        {},
      ),
    };
  }
}
