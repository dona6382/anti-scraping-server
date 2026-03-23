import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserAgentGuard } from './user-agent.guard';
import { SecurityEventService } from '../services/security-event.service';
import { InvalidUserAgentException } from '../exceptions';

describe('UserAgentGuard', () => {
  let guard: UserAgentGuard;
  let configService: ConfigService;
  let securityEventService: SecurityEventService;

  const mockSecurityEventService = {
    log: jest.fn(),
  };

  function createMockContext(userAgent: string, url = '/test'): ExecutionContext {
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
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    configService = new ConfigService({
      BLOCKED_USER_AGENTS: 'scrapy,python-requests,curl,wget',
      SECURITY_STRICT_MODE: false,
    });
    securityEventService = mockSecurityEventService as unknown as SecurityEventService;
    guard = new UserAgentGuard(configService, securityEventService);
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

  describe('Strict Mode', () => {
    beforeEach(() => {
      configService = new ConfigService({
        BLOCKED_USER_AGENTS: 'scrapy,curl',
        SECURITY_STRICT_MODE: true,
      });
      guard = new UserAgentGuard(configService, securityEventService);
    });

    it('빈 User-Agent 차단', async () => {
      const context = createMockContext('');
      await expect(guard.canActivate(context)).rejects.toThrow(InvalidUserAgentException);
    });
  });
});
