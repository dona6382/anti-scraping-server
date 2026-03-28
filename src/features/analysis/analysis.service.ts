import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { SecurityEvent } from '../../core/database/entities';
import { RequestUtils } from '../../common/utils/request.utils';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestLogEntry, REQUEST_LOG_PREFIX } from '../../common/middleware/request-logger.middleware';
import { FingerprintData } from '../../common/services/challenge.service';

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(SecurityEvent)
    private readonly eventRepo: Repository<SecurityEvent>,
    @Inject('ICacheService') private readonly cache: ICacheService,
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

  // ========================================
  // 실시간 행동 분석 (캐시 기반 — DB 쿼리 없음)
  // ========================================

  /**
   * IP의 실시간 요청 로그 조회 (캐시)
   */
  async getRealtimeRequestLog(ip: string): Promise<{
    ip: string;
    totalRequests: number;
    logs: RequestLogEntry[];
  }> {
    const normalizedIp = RequestUtils.normalizeIp(ip);
    const logs = await this.cache.get<RequestLogEntry[]>(`${REQUEST_LOG_PREFIX}${normalizedIp}`) || [];
    return {
      ip: RequestUtils.hashIp(ip, 'analysis'),
      totalRequests: logs.length,
      logs,
    };
  }

  /**
   * IP의 실시간 행동 분석 — 요청 간격, 빈도, 엔드포인트 분포
   */
  async getRealtimeBehaviorAnalysis(ip: string): Promise<{
    ip: string;
    totalRequests: number;
    windowMinutes: number;
    requestsPerMinute: number;
    intervalAnalysis: {
      meanMs: number;
      stdDevMs: number;
      cv: number;
      isRegular: boolean;
    } | null;
    endpointDistribution: Array<{ endpoint: string; count: number; percentage: number }>;
    methodDistribution: Record<string, number>;
    verdict: 'BOT_SUSPECTED' | 'INCONCLUSIVE' | 'LIKELY_HUMAN' | 'INSUFFICIENT_DATA';
    confidence: number;
  }> {
    const normalizedIp = RequestUtils.normalizeIp(ip);
    const logs = await this.cache.get<RequestLogEntry[]>(`${REQUEST_LOG_PREFIX}${normalizedIp}`) || [];

    const result = {
      ip: RequestUtils.hashIp(ip, 'analysis'),
      totalRequests: logs.length,
      windowMinutes: 0,
      requestsPerMinute: 0,
      intervalAnalysis: null as { meanMs: number; stdDevMs: number; cv: number; isRegular: boolean } | null,
      endpointDistribution: [] as Array<{ endpoint: string; count: number; percentage: number }>,
      methodDistribution: {} as Record<string, number>,
      verdict: 'INSUFFICIENT_DATA' as 'BOT_SUSPECTED' | 'INCONCLUSIVE' | 'LIKELY_HUMAN' | 'INSUFFICIENT_DATA',
      confidence: 0,
    };

    if (logs.length < 3) return result;

    // 시간 윈도우
    const firstTs = logs[0].t;
    const lastTs = logs[logs.length - 1].t;
    result.windowMinutes = Math.round((lastTs - firstTs) / 60000 * 10) / 10;
    result.requestsPerMinute = result.windowMinutes > 0
      ? Math.round(logs.length / result.windowMinutes * 10) / 10
      : logs.length;

    // 요청 간격 분석
    const intervals: number[] = [];
    for (let i = 1; i < logs.length; i++) {
      intervals.push(logs[i].t - logs[i - 1].t);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    result.intervalAnalysis = {
      meanMs: Math.round(mean),
      stdDevMs: Math.round(stdDev),
      cv: Math.round(cv * 1000) / 1000,
      isRegular: cv < 0.3,
    };

    // 엔드포인트 분포
    const endpointCount: Record<string, number> = {};
    for (const log of logs) {
      endpointCount[log.e] = (endpointCount[log.e] || 0) + 1;
    }
    result.endpointDistribution = Object.entries(endpointCount)
      .map(([endpoint, count]) => ({
        endpoint,
        count,
        percentage: Math.round(count / logs.length * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // HTTP 메서드 분포
    for (const log of logs) {
      result.methodDistribution[log.m] = (result.methodDistribution[log.m] || 0) + 1;
    }

    // 판정
    if (intervals.length >= 5) {
      if (cv < 0.3) {
        result.verdict = 'BOT_SUSPECTED';
        result.confidence = Math.min(100, Math.round((1 - cv) * 100));
      } else if (cv < 0.5) {
        result.verdict = 'INCONCLUSIVE';
        result.confidence = Math.round((1 - cv) * 50);
      } else {
        result.verdict = 'LIKELY_HUMAN';
        result.confidence = Math.min(100, Math.round(cv * 80));
      }
    }

    return result;
  }

  // ========================================
  // 핑거프린트 크로스-IP 분석 (프록시 로테이션 탐지)
  // ========================================

  /**
   * 특정 핑거프린트의 크로스-IP 분석
   * 같은 핑거프린트가 여러 IP/서브넷에서 관측되면 프록시 로테이션 의심
   */
  async getFingerprintAnalysis(fingerprint: string): Promise<{
    fingerprint: string;
    uniqueIps: number;
    uniqueSubnets: number;
    totalRequests: number;
    isSuspicious: boolean;
    ips: Array<{ ip: string; count: number }>;
  }> {
    const data = await this.cache.get<FingerprintData>(`fp:${fingerprint}`);

    if (!data) {
      return {
        fingerprint: fingerprint.substring(0, 16),
        uniqueIps: 0,
        uniqueSubnets: 0,
        totalRequests: 0,
        isSuspicious: false,
        ips: [],
      };
    }

    return {
      fingerprint: fingerprint.substring(0, 16),
      uniqueIps: data.ips.length,
      uniqueSubnets: data.subnets.length,
      totalRequests: data.count,
      isSuspicious: data.subnets.length > 3,
      ips: data.ips.map(hashedIp => ({ ip: hashedIp, count: 1 })),
    };
  }
}
