import { Injectable, NestMiddleware, Inject, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestUtils } from '../utils/request.utils';
import { ExtendedRequest } from '../../core/types';

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
 * 주의: cache read-modify-write는 비원자적 (동시 요청 시 일부 유실 가능)
 * → 분석 정확도에 미미한 영향, 보안/성능 트레이드오프로 허용
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.path;

    // 제외 경로 스킵
    if (EXCLUDED_PATHS.includes(path)) {
      next();
      return;
    }

    // 응답 완료 후 상태 코드 포함하여 로깅
    res.on('finish', () => {
      this.logRequest(req, res.statusCode).catch(err =>
        this.logger.debug(`Request log failed: ${err.message}`),
      );
    });

    next();
  }

  private async logRequest(req: Request, statusCode: number): Promise<void> {
    const ip = RequestUtils.extractClientIp(req as ExtendedRequest);
    const normalizedIp = RequestUtils.normalizeIp(ip);
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

    // 활성 IP 목록 업데이트 (scoreboard에서 cache.keys 대신 사용)
    const activeIps = await this.cache.get<string[]>(ACTIVE_IPS_KEY) || [];
    if (!activeIps.includes(normalizedIp)) {
      activeIps.push(normalizedIp);
      await this.cache.set(ACTIVE_IPS_KEY, activeIps, REQUEST_LOG_TTL);
    }
  }
}
