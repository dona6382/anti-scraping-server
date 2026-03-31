import { Injectable, NestMiddleware, Inject, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { ExtendedRequest } from '../../core/types';
import { RequestUtils } from '../utils/request.utils';

/**
 * 요청 행동 로그 항목
 */
export interface RequestLogEntry {
  /** 타임스탬프 (ms) */
  t: number;
  /** 엔드포인트 (query string 제외) */
  e: string;
  /** HTTP 메서드 */
  m: string;
  /** 응답 상태 코드 */
  s?: number;
}

export const REQUEST_LOG_TTL = 3600; // 1시간
export const MAX_ENTRIES_PER_IP = 200; // IP당 최대 저장 수
export const REQUEST_LOG_PREFIX = 'req_log:';
export const ACTIVE_IPS_KEY = 'req_log:active_ips';

// 로깅 제외 경로 (노이즈 감소)
const EXCLUDED_PATHS = ['/health', '/health/live', '/health/ready', '/favicon.ico'];

/**
 * Request Logger Middleware
 * 모든 요청의 IP+timestamp+endpoint+status를 캐시에 경량 저장
 * → 정상 요청의 행동 패턴 분석 (간격, 빈도, 엔드포인트 분포)에 활용
 *
 * 동시성: IP별 뮤텍스로 read-modify-write 직렬화 (동일 IP 동시 요청 시 유실 방지)
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);
  private readonly ipLocks = new Map<string, Promise<void>>();

  constructor(@Inject('ICacheService') private readonly cache: ICacheService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.path;

    // 제외 경로 스킵
    if (EXCLUDED_PATHS.includes(path)) {
      next();
      return;
    }

    // 응답 완료 후 상태 코드 포함하여 로깅
    res.on('finish', () => {
      this.logRequest(req, res.statusCode).catch((err) =>
        this.logger.debug(`Request log failed: ${err.message}`),
      );
    });

    next();
  }

  private async logRequest(req: Request, statusCode: number): Promise<void> {
    const ip = RequestUtils.extractClientIp(req as ExtendedRequest);
    const normalizedIp = RequestUtils.normalizeIp(ip);

    // IP별 직렬화: 동일 IP의 동시 read-modify-write 방지 (크기 제한으로 메모리 보호)
    if (this.ipLocks.size > 5000) {
      // 과도한 IP 유입 시 직렬화 없이 바로 실행 (DoS 방어)
      await this.doLogRequest(normalizedIp, req, statusCode);
      return;
    }
    const prev = this.ipLocks.get(normalizedIp) || Promise.resolve();
    const current = prev.then(async () => {
      try {
        await this.doLogRequest(normalizedIp, req, statusCode);
      } finally {
        this.ipLocks.delete(normalizedIp);
      }
    });
    this.ipLocks.set(
      normalizedIp,
      current.catch(() => {}),
    );
    await current;
  }

  private async doLogRequest(
    normalizedIp: string,
    req: Request,
    statusCode: number,
  ): Promise<void> {
    const key = `${REQUEST_LOG_PREFIX}${normalizedIp}`;

    const entry: RequestLogEntry = {
      t: Date.now(),
      e: req.path, // query string 제외 (개인정보 보호)
      m: req.method,
      s: statusCode,
    };

    const existing = await this.cache.get<RequestLogEntry[]>(key);
    const logs = existing || [];

    logs.push(entry);

    // 최대 엔트리 초과 시 오래된 것부터 제거 (ring buffer)
    if (logs.length > MAX_ENTRIES_PER_IP) {
      logs.splice(0, logs.length - MAX_ENTRIES_PER_IP);
    }

    await this.cache.set(key, logs, REQUEST_LOG_TTL);

    // 활성 IP 목록 업데이트 — Set 기반 O(1) lookup (Array.includes O(N) DoS 방지)
    const activeIps: string[] = (await this.cache.get<string[]>(ACTIVE_IPS_KEY)) || [];
    const activeSet = new Set(activeIps);
    if (!activeSet.has(normalizedIp) && activeSet.size < 10000) {
      // 상한 10K
      activeIps.push(normalizedIp);
      await this.cache.set(ACTIVE_IPS_KEY, activeIps, REQUEST_LOG_TTL);
    }
  }
}
