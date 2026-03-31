import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { HeadlessBrowserException } from '../exceptions';
import { SecurityEventService } from '../services/security-event.service';

import { HeadlessBrowserGuard } from './headless-browser.guard';

describe('HeadlessBrowserGuard', () => {
  let guard: HeadlessBrowserGuard;
  let reflector: Reflector;

  const mockSecurityEventService = {
    log: jest.fn(),
  };

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

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
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  const normalBrowserHeaders = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'accept-encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
  };

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    guard = new HeadlessBrowserGuard(
      mockSecurityEventService as unknown as SecurityEventService,
      reflector,
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
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(HeadlessBrowserException);
  });

  it('PhantomJS UA 차단', async () => {
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent':
        'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1',
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

  it('host 헤더가 4번째 이후 → score 증가 (header order fingerprinting)', async () => {
    // Object.keys preserves insertion order. Place host after 4+ other headers.
    // Use a normal browser UA but arrange headers so host is late.
    const headers: Record<string, string> = {
      'x-custom-1': 'val',
      'x-custom-2': 'val',
      'x-custom-3': 'val',
      'x-custom-4': 'val',
      host: 'example.com',
      'x-custom-5': 'val',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR,ko;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-fetch-site': 'none',
    };
    const context = createMockContext(headers);

    // hostIndex = 4 (0-based), which is > 3 and headerKeys.length > 5
    // This adds +15 to confidence score. Combined with other signals or alone,
    // it may or may not cross the threshold (50). We just verify the factor is detected.
    // With these complete headers the only extra score is +15 for header order,
    // which is below threshold (50), so it should still pass.
    expect(await guard.canActivate(context)).toBe(true);

    // But if combined with missing sec-fetch + generic accept → should cross threshold
    const suspiciousHeaders: Record<string, string> = {
      'x-custom-1': 'val',
      'x-custom-2': 'val',
      'x-custom-3': 'val',
      'x-custom-4': 'val',
      host: 'example.com',
      'x-custom-5': 'val',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: '*/*',
      'accept-language': 'ko-KR,ko;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      // missing sec-ch-ua → +25, missing sec-fetch-site → +20, generic accept → +10, header order → +15 = 70
    };
    const context2 = createMockContext(suspiciousHeaders);
    await expect(guard.canActivate(context2)).rejects.toThrow(HeadlessBrowserException);
  });

  it('@SkipHeadlessBrowser 데코레이터 있으면 건너뜀', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext({
      ...normalBrowserHeaders,
      'user-agent': 'Mozilla/5.0 HeadlessChrome/120.0.0.0',
    });
    expect(await guard.canActivate(context)).toBe(true);
  });
});
