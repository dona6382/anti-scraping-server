import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IpBlacklistGuard } from './ip-blacklist.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { SecurityEventService } from '../services/security-event.service';
import { IpBlockedException } from '../exceptions/application.exception';

describe('IpBlacklistGuard', () => {
  let guard: IpBlacklistGuard;
  let ipBlacklistService: jest.Mocked<Partial<IpBlacklistService>>;
  let securityEventService: jest.Mocked<Partial<SecurityEventService>>;
  let reflector: Reflector;

  function createMockContext(ip = '192.168.1.100', skipBlacklist = false): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
          url: '/test',
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

  beforeEach(() => {
    ipBlacklistService = {
      isBlocked: jest.fn(),
      getBlockReason: jest.fn(),
    };

    securityEventService = {
      log: jest.fn(),
    };

    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    guard = new IpBlacklistGuard(
      ipBlacklistService as unknown as IpBlacklistService,
      securityEventService as unknown as SecurityEventService,
      reflector,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('차단되지 않은 IP 허용', async () => {
    ipBlacklistService.isBlocked.mockResolvedValue(false);
    const context = createMockContext('10.0.0.1');
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('차단된 IP 거부', async () => {
    ipBlacklistService.isBlocked.mockResolvedValue(true);
    ipBlacklistService.getBlockReason.mockResolvedValue('BOT_DETECTED');
    const context = createMockContext('10.0.0.1');
    await expect(guard.canActivate(context)).rejects.toThrow(IpBlockedException);
  });

  it('차단 시 SecurityEvent 기록', async () => {
    ipBlacklistService.isBlocked.mockResolvedValue(true);
    ipBlacklistService.getBlockReason.mockResolvedValue('RATE_LIMIT_EXCEEDED');
    const context = createMockContext('10.0.0.1');

    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(securityEventService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'IP_BLOCKED',
        severity: 'HIGH',
        ip: '10.0.0.1',
      }),
    );
  });

  it('서비스 에러 시 fail-open (요청 허용)', async () => {
    ipBlacklistService.isBlocked.mockRejectedValue(new Error('Redis connection failed'));
    const context = createMockContext('10.0.0.1');
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('@SkipIpBlacklist 데코레이터 있으면 건너뜀', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext('10.0.0.1');
    expect(await guard.canActivate(context)).toBe(true);
    expect(ipBlacklistService.isBlocked).not.toHaveBeenCalled();
  });
});
