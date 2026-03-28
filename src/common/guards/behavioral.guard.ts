import { Injectable, Inject, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseSecurityGuard } from './base-security.guard';
import { SecurityEventService } from '../services/security-event.service';
import { ThreatScoreService } from '../services/threat-score.service';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestUtils } from '../utils/request.utils';
import { ExtendedRequest } from '../../core/types';
import { SecurityException } from '../exceptions/application.exception';
import { ErrorCodes } from '../constants/error.constants';
import {
  REQUEST_LOG_PREFIX,
  RequestLogEntry,
} from '../middleware/request-logger.middleware';

/**
 * Behavioral Analysis를 건너뛰는 데코레이터
 */
const SKIP_BEHAVIORAL_KEY = 'skipBehavioral';
export const SkipBehavioral = () => SetMetadata(SKIP_BEHAVIORAL_KEY, true);

/** CV threshold — 값이 낮을수록 기계적으로 일정한 간격 */
const CV_THRESHOLD = 0.3;
/** 분석에 필요한 최소 요청 수 */
const MIN_REQUESTS = 10;

/**
 * Behavioral Analysis Guard
 * 요청 간격의 변동계수(CV)를 분석하여 봇 패턴을 탐지
 *
 * CV(Coefficient of Variation) = 표준편차 / 평균
 * 사람: 불규칙한 간격 → CV 높음
 * 봇:  일정한 간격 → CV 낮음 (< 0.3)
 */
@Injectable()
export class BehavioralGuard extends BaseSecurityGuard {
  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly securityEventService: SecurityEventService,
    private readonly threatScoreService: ThreatScoreService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipBehavioral() 데코레이터가 있으면 건너뜀
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_BEHAVIORAL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);

    try {
      const normalizedIp = RequestUtils.normalizeIp(ip);
      const key = `${REQUEST_LOG_PREFIX}${normalizedIp}`;
      const logs = await this.cache.get<RequestLogEntry[]>(key);

      // 데이터 부족 시 분석 스킵 (intervals = logs - 1 이므로 +1)
      if (!logs || logs.length < MIN_REQUESTS + 1) {
        return true;
      }

      // 타임스탬프 기준 정렬 후 간격 계산
      const sorted = [...logs].sort((a, b) => a.t - b.t);
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i].t - sorted[i - 1].t);
      }

      const cv = this.calculateCV(intervals);

      if (cv < CV_THRESHOLD) {
        // BOT 패턴 탐지
        this.logSecurityViolation(
          request,
          `Bot pattern detected: CV=${cv.toFixed(4)}, intervals=${intervals.length}`,
        );

        this.securityEventService.log({
          eventType: 'BOT_DETECTED',
          severity: 'HIGH',
          ip,
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: `Behavioral analysis: mechanical request pattern (CV=${cv.toFixed(4)})`,
          eventData: {
            cv: parseFloat(cv.toFixed(4)),
            intervalCount: intervals.length,
            requestCount: logs.length,
          },
        });

        this.threatScoreService.recordViolation(ip, 'BOT_DETECTED', 'HIGH').catch(() => {});

        throw new SecurityException(
          ErrorCodes.BOT_DETECTED,
          undefined,
          { cv: parseFloat(cv.toFixed(4)) },
        );
      }

      return true;
    } catch (error) {
      if (error instanceof SecurityException) {
        throw error;
      }

      // Fail-open: 서비스 에러 시 요청 허용
      this.logger.error(
        `Behavioral analysis failed - allowing request (fail-open): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return true;
    }
  }

  /**
   * 변동계수(CV) 계산
   * CV = stddev / mean
   */
  private calculateCV(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;

    if (mean === 0) {
      return 0;
    }

    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    return stddev / mean;
  }
}
