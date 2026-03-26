import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ChallengeGuard } from './challenge.guard';
import { ChallengeService } from '../services/challenge.service';
import { Reflector } from '@nestjs/core';

describe('ChallengeGuard', () => {
  let guard: ChallengeGuard;

  const mockChallengeService = {
    verifyCookie: jest.fn(),
    generateToken: jest.fn(),
    getDifficulty: jest.fn(),
    getChallengeHtml: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  let originalApiKey: string | undefined;

  function createMockContext(
    options: {
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      cookie?: string;
    } = {},
  ): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

    const headers: Record<string, string | string[] | undefined> = {
      'user-agent': 'Mozilla/5.0 Test Browser',
      ...options.headers,
    };

    if (options.cookie !== undefined) {
      headers.cookie = options.cookie;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          url: '/test',
          method: 'GET',
          ip: options.ip ?? '192.168.1.100',
          connection: { remoteAddress: options.ip ?? '192.168.1.100' },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  beforeAll(() => {
    originalApiKey = process.env.API_KEY;
    process.env.API_KEY = 'test-api-key';
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockChallengeService.generateToken.mockResolvedValue('mock-token');
    mockChallengeService.getDifficulty.mockReturnValue(4);
    mockChallengeService.getChallengeHtml.mockReturnValue('<html>challenge</html>');

    guard = new ChallengeGuard(
      mockChallengeService as unknown as ChallengeService,
      mockReflector as unknown as Reflector,
    );
  });

  describe('@SkipChallenge() 데코레이터', () => {
    it('SkipChallenge 데코레이터 → 쿠키 없이도 통과', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();
      expect(await guard.canActivate(context)).toBe(true);
      expect(mockChallengeService.verifyCookie).not.toHaveBeenCalled();
    });
  });

  describe('x-api-key 검증', () => {
    it('올바른 API_KEY → bypass 허용', async () => {
      const context = createMockContext({
        headers: { 'x-api-key': 'test-api-key' },
      });
      expect(await guard.canActivate(context)).toBe(true);
      expect(mockChallengeService.verifyCookie).not.toHaveBeenCalled();
    });

    it('틀린 API_KEY → bypass 불가 (403 challenge)', async () => {
      const context = createMockContext({
        headers: { 'x-api-key': 'wrong-api-key' },
      });
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('같은 길이의 틀린 API_KEY → bypass 불가', async () => {
      // 'test-api-key' (12글자)와 같은 길이의 다른 키
      const context = createMockContext({
        headers: { 'x-api-key': 'xxxx-api-key' },
      });
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('API_KEY 미설정 시 → 어떤 x-api-key도 bypass 불가', async () => {
      const saved = process.env.API_KEY;
      delete process.env.API_KEY;

      try {
        const context = createMockContext({
          headers: { 'x-api-key': 'any-key' },
        });
        await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      } finally {
        process.env.API_KEY = saved;
      }
    });
  });

  describe('쿠키 검증', () => {
    it('유효한 __challenge 쿠키 → 통과', async () => {
      mockChallengeService.verifyCookie.mockReturnValue(true);
      const context = createMockContext({
        cookie: '__challenge=valid-cookie-value',
      });
      expect(await guard.canActivate(context)).toBe(true);
      expect(mockChallengeService.verifyCookie).toHaveBeenCalledWith(
        'valid-cookie-value',
        expect.any(String),
      );
    });

    it('잘못된 쿠키 → 챌린지 발급 (403)', async () => {
      mockChallengeService.verifyCookie.mockReturnValue(false);
      const context = createMockContext({
        cookie: '__challenge=invalid-cookie',
      });
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('쿠키 없음 → 챌린지 발급 (403)', async () => {
      const context = createMockContext();
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('여러 쿠키 중 __challenge 정확히 추출', async () => {
      mockChallengeService.verifyCookie.mockReturnValue(true);
      const context = createMockContext({
        cookie: 'session=abc123; __challenge=correct-value; other=xyz',
      });
      expect(await guard.canActivate(context)).toBe(true);
      expect(mockChallengeService.verifyCookie).toHaveBeenCalledWith(
        'correct-value',
        expect.any(String),
      );
    });

    it('URL-encoded 쿠키 값 → decodeURIComponent 후 정상 통과', async () => {
      // Cookie value with colons (like the real challenge cookie format: timestamp:subnet:fp:sig)
      const rawCookieValue = '1000000:192.168.1:abcdef12:aabbccdd';
      const encodedCookieValue = rawCookieValue.replace(/:/g, '%3A');

      mockChallengeService.verifyCookie.mockReturnValue(true);
      const context = createMockContext({
        cookie: `__challenge=${encodedCookieValue}`,
      });

      expect(await guard.canActivate(context)).toBe(true);
      // The guard should decode the URL-encoded value before passing to verifyCookie
      expect(mockChallengeService.verifyCookie).toHaveBeenCalledWith(
        rawCookieValue,
        expect.any(String),
      );
    });
  });

  describe('챌린지 발급', () => {
    it('쿠키 없을 때 CHALLENGE_REQUIRED HttpException(403) 발생', async () => {
      const context = createMockContext();
      try {
        await guard.canActivate(context);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('HttpException body에 type: CHALLENGE_REQUIRED 포함', async () => {
      const context = createMockContext();
      try {
        await guard.canActivate(context);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const response = (error as HttpException).getResponse();
        expect(response).toEqual(
          expect.objectContaining({ type: 'CHALLENGE_REQUIRED' }),
        );
      }
    });

    it('HttpException body에 html 포함', async () => {
      const context = createMockContext();
      try {
        await guard.canActivate(context);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const response = (error as HttpException).getResponse();
        expect(response).toEqual(
          expect.objectContaining({ html: '<html>challenge</html>' }),
        );
      }
    });
  });

  describe('Fail-open', () => {
    it('ChallengeService 예외 시 → true 반환 (fail-open)', async () => {
      mockChallengeService.generateToken.mockRejectedValue(
        new Error('Redis connection failed'),
      );
      const context = createMockContext();
      expect(await guard.canActivate(context)).toBe(true);
    });
  });
});
