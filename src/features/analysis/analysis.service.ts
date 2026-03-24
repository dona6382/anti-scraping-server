import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { SecurityEvent } from '../../core/database/entities';
import { RequestUtils } from '../../common/utils/request.utils';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly eventRepo: Repository<SecurityEvent>,
  ) {}

  /** 시간대별 차단 분포 */
  async getTimeDistribution(hours = 24) {
    const since = new Date(Date.now() - hours * 3600000);
    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select("DATE_TRUNC('hour', e.createdAt)", 'hour')
      .addSelect('COUNT(*)', 'count')
      .addSelect('e.eventType', 'eventType')
      .where('e.createdAt >= :since', { since })
      .groupBy("DATE_TRUNC('hour', e.createdAt)")
      .addGroupBy('e.eventType')
      .orderBy('hour', 'ASC')
      .getRawMany();

    return result.map(r => ({
      hour: r.hour,
      eventType: r.eventType,
      count: parseInt(r.count),
    }));
  }

  /** 가장 많이 차단된 IP 순위 */
  async getTopBlockedIps(limit = 20) {
    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(e.createdAt)', 'lastSeen')
      .where('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map(r => ({
      ip: r.ip ? RequestUtils.hashIp(r.ip, 'analysis') : 'unknown',
      count: parseInt(r.count),
      lastSeen: r.lastSeen,
    }));
  }

  /** 가장 많이 차단된 UA 순위 */
  async getTopBlockedUserAgents(limit = 20) {
    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.userAgent', 'userAgent')
      .addSelect('COUNT(*)', 'count')
      .where('e.userAgent IS NOT NULL')
      .groupBy('e.userAgent')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map(r => ({
      userAgent: (r.userAgent || '').substring(0, 100),
      count: parseInt(r.count),
    }));
  }

  /** 엔드포인트별 차단 통계 */
  async getEndpointAnalysis() {
    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.endpoint', 'endpoint')
      .addSelect('e.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('e.eventType', 'eventType')
      .where('e.endpoint IS NOT NULL')
      .groupBy('e.endpoint')
      .addGroupBy('e.method')
      .addGroupBy('e.eventType')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(r => ({
      endpoint: r.endpoint,
      method: r.method,
      eventType: r.eventType,
      count: parseInt(r.count),
    }));
  }

  /** 특정 IP의 요청 간격 분석 — 봇 탐지 핵심 */
  async getRequestIntervalAnalysis(ip: string, hours = 24) {
    const since = new Date(Date.now() - hours * 3600000);
    const events = await this.eventRepo.find({
      where: { ip, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
      select: ['createdAt'],
    });

    if (events.length < 3) {
      return { ip: RequestUtils.hashIp(ip, 'analysis'), sampleSize: events.length, isBot: false, confidence: 0 };
    }

    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(
        new Date(events[i].createdAt).getTime() - new Date(events[i - 1].createdAt).getTime(),
      );
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0; // Coefficient of Variation

    // CV < 0.3 with enough samples = bot pattern (regular intervals)
    const isBot = cv < 0.3 && intervals.length >= 5;
    const confidence = isBot ? Math.min(100, Math.round((1 - cv) * 100)) : 0;

    return {
      ip: RequestUtils.hashIp(ip, 'analysis'),
      sampleSize: events.length,
      intervalCount: intervals.length,
      meanMs: Math.round(mean),
      stdDevMs: Math.round(stdDev),
      cv: Math.round(cv * 1000) / 1000,
      isBot,
      confidence,
      verdict: isBot ? 'BOT_SUSPECTED' : cv < 0.5 ? 'INCONCLUSIVE' : 'LIKELY_HUMAN',
    };
  }

  /** 공격 패턴 클러스터링 */
  async getAttackPatterns() {
    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('e.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT e.ip)', 'uniqueIps')
      .groupBy('e.eventType')
      .addGroupBy('e.severity')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(r => ({
      eventType: r.eventType,
      severity: r.severity,
      count: parseInt(r.count),
      uniqueIps: parseInt(r.uniqueIps),
    }));
  }

  /** 특정 IP와 유사한 패턴의 다른 IP 조회 */
  async getSimilarPatterns(ip: string) {
    // Step 1: Get the target IP's event type distribution
    const targetPattern = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('e.ip = :ip', { ip })
      .groupBy('e.eventType')
      .getRawMany();

    if (targetPattern.length === 0) {
      return { ip: RequestUtils.hashIp(ip, 'analysis'), similarIps: [] };
    }

    const dominantType = targetPattern.sort((a, b) => parseInt(b.count) - parseInt(a.count))[0].eventType;

    // Step 2: Find other IPs with the same dominant event type
    const similar = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('e.eventType = :type', { type: dominantType })
      .andWhere('e.ip != :ip', { ip })
      .andWhere('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      ip: RequestUtils.hashIp(ip, 'analysis'),
      dominantEventType: dominantType,
      similarIps: similar.map(s => ({
        ip: s.ip ? RequestUtils.hashIp(s.ip, 'analysis') : 'unknown',
        count: parseInt(s.count),
      })),
    };
  }
}
