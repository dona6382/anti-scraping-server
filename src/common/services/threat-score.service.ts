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
const SCORE_TTL = 3600;

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
    return score;
  }

  async getScore(ip: string): Promise<ThreatScore | null> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    return this.cache.get<ThreatScore>(key);
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
