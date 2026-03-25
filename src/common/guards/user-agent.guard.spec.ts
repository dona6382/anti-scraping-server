import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../core/config/config.service';
import { UserAgentGuard } from './user-agent.guard';
import { SecurityEventService } from '../services/security-event.service';
import { InvalidUserAgentException } from '../exceptions';

describe('UserAgentGuard', () => {
  let guard: UserAgentGuard;
  let configService: AppConfigService;
  let securityEventService: SecurityEventService;
  let reflector: Reflector;

  const mockSecurityEventService = {
    log: jest.fn(),
  };

  function createMockContext(userAgent: string, url = '/test'): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'user-agent': userAgent },
          url,
          method: 'GET',
          ip: '127.0.0.1',
          connection: { remoteAddress: '127.0.0.1' },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    configService = {
      userAgentConfig: {
        blockedAgents: ['scrapy', 'python-requests', 'curl', 'wget'],
        strictMode: false,
      },
    } as unknown as AppConfigService;
    securityEventService = mockSecurityEventService as unknown as SecurityEventService;
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    guard = new UserAgentGuard(configService, securityEventService, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('정상 브라우저 User-Agent 허용', async () => {
    const context = createMockContext(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    );
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('scrapy User-Agent 차단', async () => {
    const context = createMockContext('Scrapy/2.11');
    await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
  });

  it('python-requests User-Agent 차단', async () => {
    const context = createMockContext('python-requests/2.31.0');
    await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
  });

  it('curl User-Agent 차단', async () => {
    const context = createMockContext('curl/8.1.2');
    await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
  });

  it('wget User-Agent 차단', async () => {
    const context = createMockContext('Wget/1.21');
    await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
  });

  it('차단 시 SecurityEvent 기록', async () => {
    const context = createMockContext('Scrapy/2.11');
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(mockSecurityEventService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'USER_AGENT_BLOCKED',
        severity: 'MEDIUM',
      }),
    );
  });

  it('빈 User-Agent는 기본 모드에서 허용', async () => {
    const context = createMockContext('');
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('@SkipUserAgent 데코레이터 있으면 건너뜀', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext('Scrapy/2.11');
    expect(await guard.canActivate(context)).toBe(true);
  });

  describe('Strict Mode', () => {
    beforeEach(() => {
      configService = {
        userAgentConfig: {
          blockedAgents: ['scrapy', 'curl'],
          strictMode: true,
        },
      } as unknown as AppConfigService;
      guard = new UserAgentGuard(configService, securityEventService, reflector);
    });

    it('빈 User-Agent 차단', async () => {
      const context = createMockContext('');
      await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
    });
  });
});
