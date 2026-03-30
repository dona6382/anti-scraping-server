import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestUtils } from '../utils/request.utils';

export interface ThreatScore {
  totalScore: number;
  violations: number;
  lastViolation: string;
  eventTypes: Record<string, number>;
  updatedAt: string;
}

const SCORE_WEIGHTS: Record<string, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

const PREEMPTIVE_BLOCK_THRESHOLD = 70;
const SCORE_TTL = 7200; // 2시간 (공격자 대기 비용 증가)
const SCORE_DECAY_RATE = 0.7; // 캐시 만료 후 재계산 시 30% 감쇠 (70→49, 100→70 유지)

@Injectable()
export class ThreatScoreService {
  private readonly logger = new Logger(ThreatScoreService.name);

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
  ) {}

  async recordViolation(
    ip: string,
    eventType: string,
    severity: string,
  ): Promise<ThreatScore> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    const existing = await this.cache.get<ThreatScore>(key);
    const weight = SCORE_WEIGHTS[severity] ?? 10;

    const score: ThreatScore = {
      totalScore: (existing?.totalScore ?? 0) + weight,
      violations: (existing?.violations ?? 0) + 1,
      lastViolation: eventType,
      eventTypes: {
        ...(existing?.eventTypes ?? {}),
        [eventType]:
          ((existing?.eventTypes ?? {})[eventType] ?? 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(key, score, SCORE_TTL);

    // 장기 이력 저장 (24시간 TTL) — 캐시 만료 후에도 감쇠 점수 유지
    if (score.totalScore >= PREEMPTIVE_BLOCK_THRESHOLD / 2) {
      const historyKey = `blocked_history:${RequestUtils.normalizeIp(ip)}`;
      await this.cache.set(historyKey, score.totalScore, 86400); // 24시간
    }

    return score;
  }

  async getScore(ip: string): Promise<ThreatScore | null> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    const cached = await this.cache.get<ThreatScore>(key);
    if (cached) return cached;

    // 캐시 미스 시 최근 블랙리스트 이력 확인 (감쇠된 기저 점수)
    const recentBlockKey = `blocked_history:${RequestUtils.normalizeIp(ip)}`;
    const lastScore = await this.cache.get<number>(recentBlockKey);
    if (lastScore && lastScore > 0) {
      const decayed = Math.floor(lastScore * SCORE_DECAY_RATE);
      if (decayed >= 10) {
        const restored: ThreatScore = {
          totalScore: decayed,
          violations: 0,
          lastViolation: 'DECAYED_HISTORY',
          eventTypes: {},
          updatedAt: new Date().toISOString(),
        };
        await this.cache.set(key, restored, SCORE_TTL);
        return restored;
      }
    }
    return null;
  }

  async shouldPreemptiveBlock(ip: string): Promise<boolean> {
    const score = await this.getScore(ip);
    return (score?.totalScore ?? 0) >= PREEMPTIVE_BLOCK_THRESHOLD;
  }

  async resetScore(ip: string): Promise<void> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    await this.cache.delete(key);
  }
}
