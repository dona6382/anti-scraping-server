import { ExecutionContext } from '@nestjs/common';
import { HeadlessBrowserGuard } from './headless-browser.guard';
import { SecurityEventService } from '../services/security-event.service';
import { HeadlessBrowserException } from '../exceptions';

describe('HeadlessBrowserGuard', () => {
  let guard: HeadlessBrowserGuard;

  const mockSecurityEventService = {
    log: jest.fn(),
  };

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          url: '/test',
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

  const normalBrowserHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'accept-encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
  };

  beforeEach(() => {
    guard = new HeadlessBrowserGuard(
      mockSecurityEventService as unknown as SecurityEventService,
    );
    jest.clearAllMocks();
  });

  it('정상 브라우저 요청 허용', async () => {
    const context = createMockContext(normalBrowserHeaders);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('HeadlessChrome UA 차단', async () => {
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(HeadlessBrowserException);
  });

  it('PhantomJS UA 차단', async () => {
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent': 'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(HeadlessBrowserException);
  });

  it('필수 헤더 누락 시 의심 점수 증가', async () => {
    const context = createMockContext({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      // accept-language, accept-encoding, accept 누락
    });
    // 점수가 50 이상이면 차단
    await expect(guard.canActivate(context)).rejects.toThrow(HeadlessBrowserException);
  });

  it('차단 시 SecurityEvent 기록', async () => {
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent': 'Mozilla/5.0 HeadlessChrome/120.0.0.0',
    });
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(mockSecurityEventService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'HEADLESS_BROWSER_DETECTED',
        severity: 'HIGH',
      }),
    );
  });

  it('Puppeteer UA 패턴 차단', async () => {
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent': 'puppeteer-core/21.0.0',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(HeadlessBrowserException);
  });
});
