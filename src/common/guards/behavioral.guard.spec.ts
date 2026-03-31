import { ExecutionContext } from '@nestjs/common';

import { SecurityException } from '../exceptions/application.exception';
import { RequestLogEntry } from '../middleware/request-logger.middleware';
import { SecurityEventService } from '../services/security-event.service';
import { ThreatScoreService } from '../services/threat-score.service';

import { BehavioralGuard } from './behavioral.guard';

describe('BehavioralGuard', () => {
  let guard: BehavioralGuard;

  const mockCache = {
    get: jest.fn(),
  };

  const mockSecurityEvent = {
    log: jest.fn(),
  };

  const mockThreatScore = {
    recordViolation: jest.fn().mockResolvedValue(undefined),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  function createMockContext(ip = '192.168.1.100'): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
          url: '/api/public/data',
          method: 'GET',
          ip,
          connection: { remoteAddress: ip },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  /**
   * 요청 로그 생성 헬퍼
   * @param count 로그 수
   * @param intervalMs 요청 간격 (ms)
   * @param jitterMs 간격의 랜덤 변동폭 (ms)
   */
  function createLogs(count: number, intervalMs: number, jitterMs = 0): RequestLogEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      t: 1000000 + i * intervalMs + Math.round((Math.random() - 0.5) * jitterMs),
      e: '/api/public/data',
      m: 'GET',
      s: 200,
    }));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockCache.get.mockResolvedValue(null);
    mockThreatScore.recordViolation.mockResolvedValue(undefined);

    guard = new BehavioralGuard(
      mockCache as any,
      mockSecurityEvent as unknown as SecurityEventService,
      mockThreatScore as unknown as ThreatScoreService,
      mockReflector as any,
    );
  });

  describe('@SkipBehavioral() 데코레이터', () => {
    it('SkipBehavioral → 분석 없이 통과', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();

      expect(await guard.canActivate(context)).toBe(true);
      expect(mockCache.get).not.toHaveBeenCalled();
    });
  });

  describe('데이터 부족', () => {
    it('캐시에 로그 없음 → 통과', async () => {
      mockCache.get.mockResolvedValue(null);
      const context = createMockContext();

      expect(await guard.canActivate(context)).toBe(true);
    });

    it('로그 5개 이하 → 통과 (MIN_REQUESTS+1=6 필요)', async () => {
      const logs = createLogs(5, 1000);
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      expect(await guard.canActivate(context)).toBe(true);
    });
  });

  describe('봇 탐지 (CV < 0.3)', () => {
    it('일정 간격 요청 (CV≈0) → 403 BOT_DETECTED', async () => {
      // 완전히 일정한 간격 → CV = 0
      const logs = createLogs(15, 1000, 0);
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(SecurityException);
    });

    it('SecurityEvent 로그 호출 확인', async () => {
      const logs = createLogs(15, 1000, 0);
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow();

      expect(mockSecurityEvent.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BOT_DETECTED',
          severity: 'HIGH',
          ip: '192.168.1.100',
        }),
      );
    });

    it('ThreatScore recordViolation 호출 확인', async () => {
      const logs = createLogs(15, 1000, 0);
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow();

      expect(mockThreatScore.recordViolation).toHaveBeenCalledWith(
        '192.168.1.100',
        'BOT_DETECTED',
        'HIGH',
      );
    });
  });

  describe('정상 사용자 (CV > 0.3)', () => {
    it('불규칙 간격 요청 → 통과', async () => {
      // 큰 jitter로 CV가 0.3을 초과하도록 설정
      // 직접 타임스탬프를 지정하여 결정적으로 만듦
      const logs: RequestLogEntry[] = [
        { t: 1000000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1000500, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1003000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1003200, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1008000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1008100, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1015000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1015050, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1025000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1025300, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1040000, e: '/api/public/data', m: 'GET', s: 200 },
      ];
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      expect(await guard.canActivate(context)).toBe(true);
    });
  });

  describe('RPM 초과 탐지', () => {
    it('RPM 30 초과 시 → BOT_DETECTED (일정 간격 불필요)', async () => {
      // 11개 로그를 짧은 시간 안에 생성 — 불규칙 간격이지만 RPM이 30 초과
      // 총 시간 = ~10초 → RPM = 11/10s * 60 = 66 RPM > 30
      const logs: RequestLogEntry[] = [
        { t: 1000000, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1000800, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1001900, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1002500, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1003700, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1004200, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1005600, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1006300, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1007800, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1008500, e: '/api/public/data', m: 'GET', s: 200 },
        { t: 1010000, e: '/api/public/data', m: 'GET', s: 200 },
      ];
      mockCache.get.mockResolvedValue(logs);
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(SecurityException);

      expect(mockSecurityEvent.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BOT_DETECTED',
          severity: 'HIGH',
          description: expect.stringContaining('excessive request rate'),
        }),
      );
    });
  });

  describe('Fail-open', () => {
    it('캐시 에러 시 → true 반환', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis connection failed'));
      const context = createMockContext();

      expect(await guard.canActivate(context)).toBe(true);
    });
  });
});
