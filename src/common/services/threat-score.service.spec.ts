import { ThreatScoreService } from './threat-score.service';

describe('ThreatScoreService', () => {
  let service: ThreatScoreService;
  let mockCache: Record<string, jest.Mock>;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };
    service = new ThreatScoreService(mockCache as any);
    jest.clearAllMocks();
  });

  describe('recordViolation', () => {
    it('첫 위반 기록 시 점수 증가', async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await service.recordViolation(
        '1.2.3.4',
        'USER_AGENT_BLOCKED',
        'MEDIUM',
      );
      expect(result.totalScore).toBe(15);
      expect(result.violations).toBe(1);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('HIGH 심각도는 30점', async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await service.recordViolation(
        '1.2.3.4',
        'HEADLESS_BROWSER_DETECTED',
        'HIGH',
      );
      expect(result.totalScore).toBe(30);
    });

    it('CRITICAL 심각도는 50점', async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await service.recordViolation(
        '1.2.3.4',
        'SUSPICIOUS_ACTIVITY',
        'CRITICAL',
      );
      expect(result.totalScore).toBe(50);
    });

    it('기존 점수에 누적', async () => {
      mockCache.get.mockResolvedValue({
        totalScore: 30,
        violations: 2,
        eventTypes: { BOT_DETECTED: 2 },
      });
      const result = await service.recordViolation(
        '1.2.3.4',
        'USER_AGENT_BLOCKED',
        'MEDIUM',
      );
      expect(result.totalScore).toBe(45);
      expect(result.violations).toBe(3);
    });

    it('이벤트 타입별 카운트 추적', async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await service.recordViolation(
        '1.2.3.4',
        'USER_AGENT_BLOCKED',
        'MEDIUM',
      );
      expect(result.eventTypes['USER_AGENT_BLOCKED']).toBe(1);
    });
  });

  describe('getScore', () => {
    it('존재하는 점수 반환', async () => {
      mockCache.get.mockResolvedValue({ totalScore: 50, violations: 3 });
      const result = await service.getScore('1.2.3.4');
      expect(result?.totalScore).toBe(50);
    });

    it('존재하지 않으면 null', async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await service.getScore('1.2.3.4');
      expect(result).toBeNull();
    });
  });

  describe('shouldPreemptiveBlock', () => {
    it('70점 이상이면 차단', async () => {
      mockCache.get.mockResolvedValue({ totalScore: 80, violations: 5 });
      expect(await service.shouldPreemptiveBlock('1.2.3.4')).toBe(true);
    });

    it('70점 미만이면 통과', async () => {
      mockCache.get.mockResolvedValue({ totalScore: 20, violations: 1 });
      expect(await service.shouldPreemptiveBlock('1.2.3.4')).toBe(false);
    });

    it('점수 없으면 통과', async () => {
      mockCache.get.mockResolvedValue(null);
      expect(await service.shouldPreemptiveBlock('1.2.3.4')).toBe(false);
    });
  });

  describe('resetScore', () => {
    it('점수 초기화', async () => {
      await service.resetScore('1.2.3.4');
      expect(mockCache.delete).toHaveBeenCalled();
    });
  });
});
