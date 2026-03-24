import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    service = new AnalysisService(mockRepo as any);
  });

  describe('getRequestIntervalAnalysis', () => {
    it('샘플 부족 시 봇 아님으로 판정', async () => {
      mockRepo.find.mockResolvedValue([{ createdAt: new Date() }]);
      const result = await service.getRequestIntervalAnalysis('1.2.3.4');
      expect(result.isBot).toBe(false);
      expect(result.sampleSize).toBe(1);
    });

    it('일정 간격 요청은 봇으로 판정', async () => {
      const now = Date.now();
      const events = Array.from({ length: 10 }, (_, i) => ({
        createdAt: new Date(now + i * 1000), // exactly 1 second apart
      }));
      mockRepo.find.mockResolvedValue(events);
      const result = await service.getRequestIntervalAnalysis('1.2.3.4');
      expect(result.isBot).toBe(true);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.verdict).toBe('BOT_SUSPECTED');
    });

    it('불규칙 간격 요청은 사람으로 판정', async () => {
      const now = Date.now();
      const events = [
        { createdAt: new Date(now) },
        { createdAt: new Date(now + 500) },
        { createdAt: new Date(now + 5000) },
        { createdAt: new Date(now + 5200) },
        { createdAt: new Date(now + 15000) },
        { createdAt: new Date(now + 45000) },
      ];
      mockRepo.find.mockResolvedValue(events);
      const result = await service.getRequestIntervalAnalysis('1.2.3.4');
      expect(result.isBot).toBe(false);
      expect(result.verdict).toBe('LIKELY_HUMAN');
    });
  });

  describe('getTopBlockedIps', () => {
    it('빈 결과 처리', async () => {
      const result = await service.getTopBlockedIps();
      expect(result).toEqual([]);
    });
  });

  describe('getAttackPatterns', () => {
    it('빈 결과 처리', async () => {
      const result = await service.getAttackPatterns();
      expect(result).toEqual([]);
    });
  });
});
