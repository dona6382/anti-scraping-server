import { AppConfigService } from '../../core/config/config.service';

import { IpBlacklistService } from './ip-blacklist.service';

describe('IpBlacklistService', () => {
  let service: IpBlacklistService;
  let mockCache: any;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    };

    const mockConfig = {
      ipBlacklistConfig: {
        ttl: 3600,
        enabled: true,
      },
    };

    service = new IpBlacklistService(mockCache, mockConfig as unknown as AppConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('blockIp', () => {
    it('IP를 캐시에 저장', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.blockIp('192.168.1.100', 'BOT_DETECTED');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100'),
        expect.objectContaining({
          ip: '192.168.1.100',
          reason: 'BOT_DETECTED',
          count: 1,
        }),
        expect.any(Number),
      );
    });

    it('이미 차단된 IP는 count 증가', async () => {
      mockCache.get.mockResolvedValue({
        ip: '192.168.1.100',
        reason: 'BOT_DETECTED',
        count: 2,
      });

      await service.blockIp('192.168.1.100', 'RATE_LIMIT_EXCEEDED');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ count: 3 }),
        expect.any(Number),
      );
    });

    it('커스텀 TTL 적용', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.blockIp('10.0.0.1', 'MANUAL_ADMIN_ACTION', 7200);

      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 7200);
    });
  });

  describe('isBlocked', () => {
    it('차단된 IP는 true 반환', async () => {
      mockCache.exists.mockResolvedValue(true);

      const result = await service.isBlocked('192.168.1.100');
      expect(result).toBe(true);
    });

    it('차단되지 않은 IP는 false 반환', async () => {
      mockCache.exists.mockResolvedValue(false);

      const result = await service.isBlocked('10.0.0.1');
      expect(result).toBe(false);
    });
  });

  describe('unblockIp', () => {
    it('IP 차단 해제', async () => {
      await service.unblockIp('192.168.1.100');

      expect(mockCache.delete).toHaveBeenCalledWith(expect.stringContaining('192.168.1.100'));
    });
  });

  describe('getBlocklist', () => {
    it('차단 목록 batch 조회', async () => {
      mockCache.keys.mockResolvedValue(['ip_blacklist:1.1.1.1', 'ip_blacklist:2.2.2.2']);
      mockCache.getMany.mockResolvedValue([
        { ip: '1.1.1.1', reason: 'BOT_DETECTED', count: 1 },
        { ip: '2.2.2.2', reason: 'RATE_LIMIT_EXCEEDED', count: 3 },
      ]);

      const result = await service.getBlocklist();

      expect(result).toHaveLength(2);
      expect(mockCache.getMany).toHaveBeenCalledWith([
        'ip_blacklist:1.1.1.1',
        'ip_blacklist:2.2.2.2',
      ]);
    });

    it('빈 목록은 빈 배열 반환', async () => {
      mockCache.keys.mockResolvedValue([]);

      const result = await service.getBlocklist();
      expect(result).toHaveLength(0);
    });
  });

  describe('isValidIp', () => {
    it('유효한 IPv4 주소', () => {
      expect(service.isValidIp('192.168.1.1')).toBe(true);
      expect(service.isValidIp('10.0.0.1')).toBe(true);
    });

    it('유효하지 않은 IP 주소', () => {
      expect(service.isValidIp('999.999.999.999')).toBe(false);
      expect(service.isValidIp('not-an-ip')).toBe(false);
      expect(service.isValidIp('')).toBe(false);
    });
  });
});
