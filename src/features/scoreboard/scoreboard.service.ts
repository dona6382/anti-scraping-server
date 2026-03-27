import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { SecurityEvent } from '../../core/database/entities';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestLogEntry, REQUEST_LOG_PREFIX, ACTIVE_IPS_KEY } from '../../common/middleware/request-logger.middleware';
import { ThreatScoreService } from '../../common/services/threat-score.service';
import { RequestUtils } from '../../common/utils/request.utils';

/** Blocked event types used for defense scoring */
const BLOCKED_EVENT_TYPES = [
  'IP_BLOCKED',
  'USER_AGENT_BLOCKED',
  'HEADLESS_BROWSER_DETECTED',
  'BOT_DETECTED',
  'RATE_LIMITED',
  'AUTO_BLOCKED',
  'HONEYPOT_TRIGGERED',
] as const;

/** eventType → Guard display name mapping */
const GUARD_MAPPING: Record<string, string> = {
  RATE_LIMITED: 'Rate Limiting',
  IP_BLOCKED: 'IP Blacklist',
  AUTO_BLOCKED: 'IP Blacklist',
  USER_AGENT_BLOCKED: 'User-Agent Filter',
  HEADLESS_BROWSER_DETECTED: 'Headless Detection',
  BOT_DETECTED: 'Behavioral Analysis',
  HONEYPOT_TRIGGERED: 'Honeypot',
};

/** Guard layer definition for aggregation */
interface GuardLayer {
  name: string;
  eventTypes: string[];
}

const GUARD_LAYERS: GuardLayer[] = [
  { name: 'Rate Limiting', eventTypes: ['RATE_LIMITED'] },
  { name: 'IP Blacklist', eventTypes: ['IP_BLOCKED', 'AUTO_BLOCKED'] },
  { name: 'User-Agent Filter', eventTypes: ['USER_AGENT_BLOCKED'] },
  { name: 'Headless Detection', eventTypes: ['HEADLESS_BROWSER_DETECTED'] },
  { name: 'Behavioral Analysis', eventTypes: ['BOT_DETECTED'] },
  { name: 'Honeypot', eventTypes: ['HONEYPOT_TRIGGERED'] },
];

const SUMMARY_CACHE_TTL = 30; // 30-second caching

@Injectable()
export class ScoreboardService {
  private readonly logger = new Logger(ScoreboardService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly eventRepo: Repository<SecurityEvent>,
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly threatScoreService: ThreatScoreService,
  ) {}

  // ========================================
  // 1. Summary
  // ========================================

  async getSummary(hours = 1) {
    const cacheKey = `scoreboard:summary:${hours}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - hours * 3600000);
    const now = new Date();

    // Count blocked events from SecurityEvent DB
    const blockedCount = await this.eventRepo.count({
      where: {
        eventType: In([...BLOCKED_EVENT_TYPES]),
        createdAt: MoreThanOrEqual(since),
      },
    });

    // Count success requests from Request Logger cache
    const successCount = await this.countSuccessRequests(since);

    const total = blockedCount + successCount;
    const defenseScore = total > 0
      ? Math.round((blockedCount / total) * 1000) / 10
      : 0;
    const attackScore = Math.round((100 - defenseScore) * 10) / 10;

    // Top attacker IP
    const topAttacker = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .andWhere('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    // Top target endpoint
    const topEndpoint = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.endpoint', 'endpoint')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .andWhere('e.endpoint IS NOT NULL')
      .groupBy('e.endpoint')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    // Active threats (unique IPs with events in window)
    const activeThreatsResult = await this.eventRepo
      .createQueryBuilder('e')
      .select('COUNT(DISTINCT e.ip)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .andWhere('e.ip IS NOT NULL')
      .getRawOne();

    const result = {
      defense: {
        score: defenseScore,
        totalBlocked: blockedCount,
        totalEvents: total,
      },
      attack: {
        score: attackScore,
        totalSuccess: successCount,
        totalRequests: total,
      },
      period: {
        hours,
        from: since.toISOString(),
        to: now.toISOString(),
      },
      topAttackerIp: topAttacker?.ip
        ? RequestUtils.hashIp(topAttacker.ip, 'scoreboard')
        : null,
      topTargetEndpoint: topEndpoint?.endpoint || null,
      activeThreats: parseInt(activeThreatsResult?.count || '0'),
    };

    await this.cache.set(cacheKey, result, SUMMARY_CACHE_TTL);
    return result;
  }

  // ========================================
  // 2. Guard Layers
  // ========================================

  async getLayers(hours = 1) {
    const since = new Date(Date.now() - hours * 3600000);

    // Get counts per eventType
    const rawCounts = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .groupBy('e.eventType')
      .getRawMany();

    const countMap: Record<string, number> = {};
    for (const row of rawCounts) {
      countMap[row.eventType] = parseInt(row.count);
    }

    let totalBlocked = 0;
    const layers = GUARD_LAYERS.map(layer => {
      const blocked = layer.eventTypes.reduce(
        (sum, et) => sum + (countMap[et] || 0),
        0,
      );
      totalBlocked += blocked;
      return {
        name: layer.name,
        eventTypes: layer.eventTypes,
        blocked,
        percentage: 0, // will be filled after total is known
      };
    });

    // Calculate percentages
    for (const layer of layers) {
      layer.percentage = totalBlocked > 0
        ? Math.round((layer.blocked / totalBlocked) * 1000) / 10
        : 0;
    }

    return { layers, totalBlocked };
  }

  // ========================================
  // 3. Attacker Analysis
  // ========================================

  async getAttackerAnalysis(ip: string, hours = 1) {
    const since = new Date(Date.now() - hours * 3600000);

    // Blocked events for this IP
    const events = await this.eventRepo.find({
      where: {
        ip,
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'ASC' },
    });

    const blockedEvents = events.filter(e =>
      (BLOCKED_EVENT_TYPES as readonly string[]).includes(e.eventType),
    );

    // Success requests from cache
    const normalizedIp = RequestUtils.normalizeIp(ip);
    const logs = await this.cache.get<RequestLogEntry[]>(
      `${REQUEST_LOG_PREFIX}${normalizedIp}`,
    ) || [];

    const sinceTs = since.getTime();
    const recentLogs = logs.filter(l => l.t >= sinceTs);
    const successLogs = recentLogs.filter(l => l.s === 200);

    const blockedCount = blockedEvents.length;
    const successCount = successLogs.length;
    const totalRequests = blockedCount + successCount;

    // Event breakdown
    const eventBreakdown: Record<string, number> = {};
    for (const e of blockedEvents) {
      eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1;
    }

    // Target endpoints (from blocked events + success logs)
    const endpointCount: Record<string, number> = {};
    for (const e of blockedEvents) {
      if (e.endpoint) {
        endpointCount[e.endpoint] = (endpointCount[e.endpoint] || 0) + 1;
      }
    }
    for (const l of recentLogs) {
      endpointCount[l.e] = (endpointCount[l.e] || 0) + 1;
    }
    const targetEndpoints = Object.entries(endpointCount)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count);

    // Behavior analysis (request interval CV)
    const behaviorAnalysis = this.analyzeRequestIntervals(recentLogs);

    // Threat score
    const threatScore = await this.threatScoreService.getScore(ip);

    return {
      ip: RequestUtils.hashIp(ip, 'scoreboard'),
      totalRequests,
      blockedCount,
      successCount,
      successRate: totalRequests > 0
        ? Math.round((successCount / totalRequests) * 1000) / 10
        : 0,
      threatScore: threatScore?.totalScore ?? 0,
      eventBreakdown,
      targetEndpoints,
      behaviorAnalysis,
    };
  }

  // ========================================
  // 4. Timeline
  // ========================================

  async getTimeline(hours = 1) {
    const since = new Date(Date.now() - hours * 3600000);
    const intervalMinutes = 5;

    // Blocked events in 5-minute buckets
    const blockedRaw = await this.eventRepo
      .createQueryBuilder('e')
      .select(
        `DATE_TRUNC('minute', e.createdAt) - (EXTRACT(MINUTE FROM e.createdAt)::int % :interval) * INTERVAL '1 minute'`,
        'bucket',
      )
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .setParameter('interval', intervalMinutes)
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    const blockedMap = new Map<string, number>();
    for (const row of blockedRaw) {
      const key = new Date(row.bucket).toISOString();
      blockedMap.set(key, parseInt(row.count));
    }

    // Success requests from cache — bucket by 5-minute intervals
    const successMap = await this.getSuccessTimeline(since, intervalMinutes);

    // Build intervals
    const intervals: Array<{
      time: string;
      blocked: number;
      success: number;
      total: number;
      defenseScore: number;
    }> = [];

    const startMs = since.getTime();
    const endMs = Date.now();
    const intervalMs = intervalMinutes * 60000;

    for (let t = startMs; t < endMs; t += intervalMs) {
      const bucketDate = new Date(t);
      // Align to 5-minute boundary
      bucketDate.setSeconds(0, 0);
      bucketDate.setMinutes(
        Math.floor(bucketDate.getMinutes() / intervalMinutes) * intervalMinutes,
      );
      const key = bucketDate.toISOString();

      const blocked = blockedMap.get(key) || 0;
      const success = successMap.get(key) || 0;
      const total = blocked + success;

      intervals.push({
        time: key,
        blocked,
        success,
        total,
        defenseScore: total > 0
          ? Math.round((blocked / total) * 1000) / 10
          : 0,
      });
    }

    // Deduplicate by time key (alignment may produce duplicates)
    const seen = new Set<string>();
    const dedupedIntervals = intervals.filter(i => {
      if (seen.has(i.time)) return false;
      seen.add(i.time);
      return true;
    });

    return { intervals: dedupedIntervals, intervalMinutes };
  }

  // ========================================
  // 5. Recommendations
  // ========================================

  async getRecommendations(hours = 1) {
    const since = new Date(Date.now() - hours * 3600000);

    const layersData = await this.getLayers(hours);
    const successCount = await this.countSuccessRequests(since);
    const blockedCount = layersData.totalBlocked;
    const total = blockedCount + successCount;

    const defense: Array<{
      priority: string;
      message: string;
      metric: string;
      value: number;
    }> = [];

    const attack: Array<{
      priority: string;
      message: string;
      metric: string;
      value: number;
    }> = [];

    // ---- Defense recommendations ----

    // Guard with 0% blocks
    if (total > 0) {
      for (const layer of layersData.layers) {
        if (layer.blocked === 0) {
          defense.push({
            priority: 'HIGH',
            message: `${layer.name} layer is not catching any attacks — review configuration`,
            metric: 'guardBlockRate',
            value: 0,
          });
        }
      }
    }

    // Single endpoint >60% of attacks
    const endpointConcentration = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.endpoint', 'endpoint')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .andWhere('e.endpoint IS NOT NULL')
      .groupBy('e.endpoint')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    if (endpointConcentration && blockedCount > 0) {
      const concentration = parseInt(endpointConcentration.count);
      const pct = Math.round((concentration / blockedCount) * 100);
      if (pct > 60) {
        defense.push({
          priority: 'MEDIUM',
          message: `Attack concentrated on ${endpointConcentration.endpoint} (${pct}%) — reinforce this endpoint`,
          metric: 'endpointConcentration',
          value: pct,
        });
      }
    }

    // Honeypot not triggered
    const honeypotLayer = layersData.layers.find(l => l.name === 'Honeypot');
    if (honeypotLayer && honeypotLayer.blocked === 0 && blockedCount > 0) {
      defense.push({
        priority: 'MEDIUM',
        message: 'Attacker avoiding honeypot traps — consider adding new trap paths',
        metric: 'honeypotTriggerRate',
        value: 0,
      });
    }

    // Attack success rate >20%
    if (total > 0) {
      const successRate = Math.round((successCount / total) * 100);
      if (successRate > 20) {
        defense.push({
          priority: 'HIGH',
          message: `High attack success rate (${successRate}%) — review security chain`,
          metric: 'attackSuccessRate',
          value: successRate,
        });
      }
    }

    // ---- Attack recommendations (external observable only, no Guard names) ----

    // 403 rate >80%
    if (total > 0) {
      const blockRate = Math.round((blockedCount / total) * 100);
      if (blockRate > 80) {
        attack.push({
          priority: 'HIGH',
          message: `Most requests blocked (${blockRate}%) — header configuration may be insufficient`,
          metric: 'blockRate',
          value: blockRate,
        });
      }
    }

    // Same IP repeated blocks >90%
    const ipBlockConcentration = await this.getTopIpBlockRate(since);
    if (ipBlockConcentration !== null && ipBlockConcentration > 90) {
      attack.push({
        priority: 'MEDIUM',
        message: 'Repeated blocks from same IP — IP rotation needed',
        metric: 'sameIpBlockRate',
        value: Math.round(ipBlockConcentration),
      });
    }

    // Regular request intervals (CV<0.3) — check from cache
    const regularIntervalDetected = await this.detectRegularIntervals(since);
    if (regularIntervalDetected) {
      attack.push({
        priority: 'HIGH',
        message: 'Regular request intervals detected — add random delays between requests',
        metric: 'intervalRegularity',
        value: regularIntervalDetected.cv,
      });
    }

    // Honeypot triggered
    if (honeypotLayer && honeypotLayer.blocked > 0) {
      attack.push({
        priority: 'HIGH',
        message: 'Fell into honeypot trap — avoid predictable paths (/api/internal/*, /api/v2/*)',
        metric: 'honeypotTriggered',
        value: honeypotLayer.blocked,
      });
    }

    return { defense, attack };
  }

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Count status-200 requests from Request Logger cache within time window
   */
  private async countSuccessRequests(since: Date): Promise<number> {
    const sinceTs = since.getTime();
    const activeIps = await this.cache.get<string[]>(ACTIVE_IPS_KEY) || [];
    const keys = activeIps.map(ip => `${REQUEST_LOG_PREFIX}${ip}`);

    let count = 0;
    for (const key of keys) {
      const logs = await this.cache.get<RequestLogEntry[]>(key);
      if (!logs) continue;
      for (const log of logs) {
        if (log.t >= sinceTs && log.s === 200) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Build success request timeline from cache
   */
  private async getSuccessTimeline(
    since: Date,
    intervalMinutes: number,
  ): Promise<Map<string, number>> {
    const sinceTs = since.getTime();
    const activeIps = await this.cache.get<string[]>(ACTIVE_IPS_KEY) || [];
    const keys = activeIps.map(ip => `${REQUEST_LOG_PREFIX}${ip}`);
    const map = new Map<string, number>();

    for (const key of keys) {
      const logs = await this.cache.get<RequestLogEntry[]>(key);
      if (!logs) continue;
      for (const log of logs) {
        if (log.t >= sinceTs && log.s === 200) {
          const d = new Date(log.t);
          d.setSeconds(0, 0);
          d.setMinutes(
            Math.floor(d.getMinutes() / intervalMinutes) * intervalMinutes,
          );
          const bucketKey = d.toISOString();
          map.set(bucketKey, (map.get(bucketKey) || 0) + 1);
        }
      }
    }
    return map;
  }

  /**
   * Analyze request intervals for behavior analysis
   */
  private analyzeRequestIntervals(logs: RequestLogEntry[]): {
    cv: number;
    verdict: string;
    requestsPerMinute: number;
  } {
    if (logs.length < 3) {
      return { cv: 0, verdict: 'INSUFFICIENT_DATA', requestsPerMinute: 0 };
    }

    const intervals: number[] = [];
    for (let i = 1; i < logs.length; i++) {
      intervals.push(logs[i].t - logs[i - 1].t);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? Math.round((stdDev / mean) * 1000) / 1000 : 0;

    const firstTs = logs[0].t;
    const lastTs = logs[logs.length - 1].t;
    const windowMinutes = (lastTs - firstTs) / 60000;
    const requestsPerMinute = windowMinutes > 0
      ? Math.round((logs.length / windowMinutes) * 10) / 10
      : logs.length;

    let verdict = 'LIKELY_HUMAN';
    if (intervals.length >= 5) {
      if (cv < 0.3) verdict = 'BOT_SUSPECTED';
      else if (cv < 0.5) verdict = 'INCONCLUSIVE';
    } else {
      verdict = 'INSUFFICIENT_DATA';
    }

    return { cv, verdict, requestsPerMinute };
  }

  /**
   * Check if a single IP accounts for >90% of all blocks
   */
  private async getTopIpBlockRate(since: Date): Promise<number | null> {
    const totalBlocked = await this.eventRepo.count({
      where: {
        eventType: In([...BLOCKED_EVENT_TYPES]),
        createdAt: MoreThanOrEqual(since),
      },
    });

    if (totalBlocked === 0) return null;

    const topIp = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .andWhere('e.eventType IN (:...types)', { types: [...BLOCKED_EVENT_TYPES] })
      .andWhere('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    if (!topIp) return null;

    return (parseInt(topIp.count) / totalBlocked) * 100;
  }

  /**
   * Detect if any IP has regular request intervals (CV < 0.3)
   */
  private async detectRegularIntervals(
    since: Date,
  ): Promise<{ cv: number } | null> {
    const sinceTs = since.getTime();
    const activeIps = await this.cache.get<string[]>(ACTIVE_IPS_KEY) || [];
    const keys = activeIps.map(ip => `${REQUEST_LOG_PREFIX}${ip}`);

    for (const key of keys) {
      const logs = await this.cache.get<RequestLogEntry[]>(key);
      if (!logs || logs.length < 6) continue;

      const recentLogs = logs.filter(l => l.t >= sinceTs);
      if (recentLogs.length < 6) continue;

      const intervals: number[] = [];
      for (let i = 1; i < recentLogs.length; i++) {
        intervals.push(recentLogs[i].t - recentLogs[i - 1].t);
      }

      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (mean === 0) continue;
      const variance =
        intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
      const cv = Math.sqrt(variance) / mean;

      if (cv < 0.3) {
        return { cv: Math.round(cv * 1000) / 1000 };
      }
    }

    return null;
  }
}
