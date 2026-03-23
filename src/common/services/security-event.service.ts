import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';

import { SecurityEvent } from '../../core/database/entities';

export type SecurityEventType =
  | 'IP_BLOCKED'
  | 'IP_UNBLOCKED'
  | 'BOT_DETECTED'
  | 'RATE_LIMITED'
  | 'HONEYPOT_TRIGGERED'
  | 'USER_AGENT_BLOCKED'
  | 'HEADLESS_BROWSER_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'ADMIN_ACTION'
  | 'SYSTEM_ALERT';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface LogSecurityEventDto {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  description: string;
  eventData?: Record<string, any>;
  actions?: {
    blocked: boolean;
    notified: boolean;
    escalated: boolean;
    autoResolved: boolean;
  };
}

/**
 * Security Event Service
 * 보안 이벤트를 DB에 기록하고 조회하는 서비스
 */
@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
  ) {}

  /**
   * 보안 이벤트 기록
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

      // 비동기로 저장 (Guard 응답 속도에 영향 주지 않음)
      this.securityEventRepository.save(event).catch((err) => {
        this.logger.error(`Failed to save security event: ${err.message}`);
      });
    } catch (error) {
      this.logger.error(`Failed to create security event: ${error}`);
    }
  }

  /**
   * 보안 이벤트 목록 조회 (페이지네이션)
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    severity?: string;
    eventType?: string;
  }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 보안 통계
   */
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

    // 이벤트 타입별 카운트
    const byType = await this.securityEventRepository
      .createQueryBuilder('event')
      .select('event.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.eventType')
      .getRawMany();

    // severity별 카운트
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
