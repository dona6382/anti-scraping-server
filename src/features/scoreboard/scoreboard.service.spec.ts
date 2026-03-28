import { ScoreboardService } from './scoreboard.service';
import { RequestUtils } from '../../common/utils/request.utils';

describe('ScoreboardService', () => {
  let service: ScoreboardService;
  let mockRepo: Record<string, jest.Mock>;
  let mockCache: Record<string, jest.Mock>;
  let mockThreatScore: Record<string, jest.Mock>;
  let qb: Record<string, jest.Mock>;

  beforeEach(() => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
    };
    mockRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
    };
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
    };
    mockThreatScore = {
      getScore: jest.fn().mockResolvedValue(null),
    };

    service = new ScoreboardService(
      mockRepo as any,
      mockCache as any,
      mockThreatScore as any,
    );
  });

  // ========================================
  // 1. getSummary
  // ========================================
  describe('getSummary()', () => {
    it('이벤트 없을 때 → defenseScore 0, totalBlocked 0', async () => {
      // count=0, no cache, no active IPs
      mockRepo.count.mockResolvedValue(0);
      mockCache.get.mockResolvedValue(null);

      const result = await service.getSummary(1) as any;

      expect(result.defense.score).toBe(0);
      // attackScore = 100 - defenseScore = 100 when no events
      expect(result.attack.score).toBe(100);
      expect(result.defense.totalBlocked).toBe(0);
      expect(result.defense.totalEvents).toBe(0);
    });

    it('차단 이벤트만 있을 때 → defenseScore 100', async () => {
      mockRepo.count.mockResolvedValue(10);
      // No active IPs → successCount = 0
      mockCache.get.mockResolvedValue(null);

      const result = await service.getSummary(1) as any;

      expect(result.defense.score).toBe(100);
      expect(result.defense.totalBlocked).toBe(10);
      expect(result.defense.totalEvents).toBe(10);
      expect(result.attack.score).toBe(0);
    });

    it('캐시 히트 시 → DB 쿼리 없이 캐시 반환', async () => {
      const cachedData = {
        defense: { score: 50, totalBlocked: 5, totalEvents: 10 },
        attack: { score: 50, totalSuccess: 5, totalRequests: 10 },
      };
      mockCache.get.mockResolvedValue(cachedData);

      const result = await service.getSummary(1);

      expect(result).toBe(cachedData);
      expect(mockRepo.count).not.toHaveBeenCalled();
      expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('topAttackerIp 해시 확인', async () => {
      const rawIp = '192.168.1.100';
      mockRepo.count.mockResolvedValue(5);
      // First cache.get returns null (no cache hit for summary)
      // Second cache.get returns null (ACTIVE_IPS_KEY)
      mockCache.get.mockResolvedValue(null);

      // First createQueryBuilder call → topAttacker
      // Second → topEndpoint
      // Third → activeThreats
      let callCount = 0;
      mockRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        const localQb = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(null),
          getRawMany: jest.fn().mockResolvedValue([]),
        };
        if (callCount === 1) {
          // topAttacker query
          localQb.getRawOne.mockResolvedValue({ ip: rawIp, count: '5' });
        }
        if (callCount === 3) {
          // activeThreats query
          localQb.getRawOne.mockResolvedValue({ count: '1' });
        }
        return localQb;
      });

      const result = await service.getSummary(1) as any;

      const expectedHash = RequestUtils.hashIp(rawIp, 'scoreboard');
      expect(result.topAttackerIp).toBe(expectedHash);
      expect(result.topAttackerIp).not.toBe(rawIp);
      expect(result.topAttackerIp).toHaveLength(16);
    });
  });

  // ========================================
  // 2. getLayers
  // ========================================
  describe('getLayers()', () => {
    it('Guard별 차단 통계 정상 집계', async () => {
      qb.getRawMany.mockResolvedValue([
        { eventType: 'RATE_LIMITED', count: '10' },
        { eventType: 'IP_BLOCKED', count: '5' },
        { eventType: 'AUTO_BLOCKED', count: '3' },
        { eventType: 'HONEYPOT_TRIGGERED', count: '2' },
      ]);

      const result = await service.getLayers(1);

      expect(result.totalBlocked).toBe(20);

      const rateLayer = result.layers.find(l => l.name === 'Rate Limiting');
      expect(rateLayer!.blocked).toBe(10);
      expect(rateLayer!.percentage).toBe(50);

      const ipLayer = result.layers.find(l => l.name === 'IP Blacklist');
      expect(ipLayer!.blocked).toBe(8); // IP_BLOCKED(5) + AUTO_BLOCKED(3)
      expect(ipLayer!.percentage).toBe(40);

      const honeypotLayer = result.layers.find(l => l.name === 'Honeypot');
      expect(honeypotLayer!.blocked).toBe(2);
      expect(honeypotLayer!.percentage).toBe(10);
    });

    it('전체 차단 0일 때 → 모든 percentage 0', async () => {
      qb.getRawMany.mockResolvedValue([]);

      const result = await service.getLayers(1);

      expect(result.totalBlocked).toBe(0);
      for (const layer of result.layers) {
        expect(layer.percentage).toBe(0);
        expect(layer.blocked).toBe(0);
      }
    });
  });

  // ========================================
  // 3. getTimeline
  // ========================================
  describe('getTimeline()', () => {
    it('5분 단위 버킷 생성 확인', async () => {
      qb.getRawMany.mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const result = await service.getTimeline(1);

      expect(result.intervalMinutes).toBe(5);
      expect(result.intervals.length).toBeGreaterThan(0);
      // Should have roughly 12 buckets for 1 hour (60/5)
      expect(result.intervals.length).toBeLessThanOrEqual(13);
      expect(result.intervals.length).toBeGreaterThanOrEqual(11);

      // Each interval should have the expected shape
      for (const interval of result.intervals) {
        expect(interval).toHaveProperty('time');
        expect(interval).toHaveProperty('blocked');
        expect(interval).toHaveProperty('success');
        expect(interval).toHaveProperty('total');
        expect(interval).toHaveProperty('defenseScore');
      }

      // Check 5-minute alignment: minutes should be divisible by 5
      for (const interval of result.intervals) {
        const minutes = new Date(interval.time).getMinutes();
        expect(minutes % 5).toBe(0);
      }
    });
  });

  // ========================================
  // 4. getRecommendations
  // ========================================
  describe('getRecommendations()', () => {
    it('차단율 0% Guard → HIGH 방어 추천', async () => {
      // getLayers returns layers where some guards have 0 blocks
      qb.getRawMany.mockResolvedValue([
        { eventType: 'RATE_LIMITED', count: '10' },
      ]);
      // count for countSuccessRequests: total > 0 needed
      mockRepo.count.mockResolvedValue(0);
      // ACTIVE_IPS_KEY returns IPs with success logs
      let getCalls = 0;
      mockCache.get.mockImplementation(async (key: string) => {
        getCalls++;
        if (key === 'req_log:active_ips') {
          return ['1.1.1.1'];
        }
        if (key === 'req_log:1.1.1.1') {
          return [{ t: Date.now(), e: '/api/test', m: 'GET', s: 200 }];
        }
        return null;
      });

      const result = await service.getRecommendations(1);

      // Guards with 0 blocks should generate HIGH defense recommendations
      const zeroBlockRecs = result.defense.filter(
        r => r.metric === 'guardBlockRate' && r.priority === 'HIGH',
      );
      // Multiple guards have 0 blocks (IP Blacklist, User-Agent, Headless, Behavioral, Honeypot)
      expect(zeroBlockRecs.length).toBeGreaterThan(0);
      expect(zeroBlockRecs[0].priority).toBe('HIGH');
    });

    it('공격 성공률 >80% → HIGH 공격 추천', async () => {
      // Very few blocks, many successes → blockRate > 80 triggers attack recommendation
      qb.getRawMany.mockResolvedValue([
        { eventType: 'RATE_LIMITED', count: '1' },
      ]);
      // For getTopIpBlockRate call
      mockRepo.count.mockResolvedValue(1);

      // Make success count high: 9 successes + 1 blocked = 90% success
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === 'req_log:active_ips') {
          return ['1.1.1.1'];
        }
        if (key === 'req_log:1.1.1.1') {
          const now = Date.now();
          return Array.from({ length: 9 }, (_, i) => ({
            t: now - i * 1000,
            e: '/api/test',
            m: 'GET',
            s: 200,
          }));
        }
        return null;
      });

      const result = await service.getRecommendations(1);

      // blockRate = 1/10 = 10%, so attack "most requests blocked" won't fire
      // But attackSuccessRate = 90% > 20% → HIGH defense rec
      const highAttackSuccessRec = result.defense.filter(
        r => r.metric === 'attackSuccessRate' && r.priority === 'HIGH',
      );
      expect(highAttackSuccessRec.length).toBe(1);
      expect(highAttackSuccessRec[0].value).toBeGreaterThan(80);
    });

    it('Honeypot 미트리거 → 방어 추천', async () => {
      // Some blocks exist but honeypot has 0
      qb.getRawMany.mockResolvedValue([
        { eventType: 'RATE_LIMITED', count: '10' },
      ]);
      mockRepo.count.mockResolvedValue(0);
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(1);

      const honeypotRec = result.defense.find(
        r => r.metric === 'honeypotTriggerRate',
      );
      expect(honeypotRec).toBeDefined();
      expect(honeypotRec!.priority).toBe('MEDIUM');
      expect(honeypotRec!.message).toContain('honeypot');
    });
  });

  // ========================================
  // 5. getAttackerAnalysis
  // ========================================
  describe('getAttackerAnalysis()', () => {
    it('IP 해시 확인', async () => {
      const rawIp = '10.0.0.1';
      mockRepo.find.mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);
      mockThreatScore.getScore.mockResolvedValue(null);

      const result = await service.getAttackerAnalysis(rawIp, 1);

      const expectedHash = RequestUtils.hashIp(rawIp, 'scoreboard');
      expect(result.ip).toBe(expectedHash);
      expect(result.ip).not.toBe(rawIp);
      expect(result.ip).toHaveLength(16);
    });

    it('eventBreakdown 집계', async () => {
      const now = Date.now();
      const events = [
        {
          eventType: 'RATE_LIMITED',
          ip: '10.0.0.1',
          endpoint: '/api/data',
          createdAt: new Date(now - 1000),
        },
        {
          eventType: 'RATE_LIMITED',
          ip: '10.0.0.1',
          endpoint: '/api/data',
          createdAt: new Date(now - 2000),
        },
        {
          eventType: 'IP_BLOCKED',
          ip: '10.0.0.1',
          endpoint: '/api/users',
          createdAt: new Date(now - 3000),
        },
        {
          eventType: 'REQUEST_LOGGED',
          ip: '10.0.0.1',
          endpoint: '/api/test',
          createdAt: new Date(now - 4000),
        },
      ];
      mockRepo.find.mockResolvedValue(events);
      mockCache.get.mockResolvedValue(null);
      mockThreatScore.getScore.mockResolvedValue({ totalScore: 75 });

      const result = await service.getAttackerAnalysis('10.0.0.1', 1);

      // Only blocked event types should appear in breakdown
      expect(result.eventBreakdown['RATE_LIMITED']).toBe(2);
      expect(result.eventBreakdown['IP_BLOCKED']).toBe(1);
      expect(result.eventBreakdown['REQUEST_LOGGED']).toBeUndefined();
      expect(result.blockedCount).toBe(3);
      expect(result.threatScore).toBe(75);
    });
  });
});
