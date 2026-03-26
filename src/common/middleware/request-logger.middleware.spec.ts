import {
  RequestLoggerMiddleware,
  REQUEST_LOG_PREFIX,
  REQUEST_LOG_TTL,
  MAX_ENTRIES_PER_IP,
} from './request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let mockCache: Record<string, jest.Mock>;
  let next: jest.Mock;
  let finishCallback: (() => void) | null;

  function createMockReq(path: string, method = 'GET', ip = '192.168.1.100') {
    return {
      path,
      method,
      ip,
      headers: {},
      connection: { remoteAddress: ip },
      socket: { remoteAddress: ip },
    } as any;
  }

  function createMockRes(statusCode = 200) {
    finishCallback = null;
    return {
      statusCode,
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') {
          finishCallback = cb;
        }
      }),
    } as any;
  }

  beforeEach(() => {
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      getAndDelete: jest.fn(),
      exists: jest.fn(),
      clear: jest.fn(),
      getMany: jest.fn(),
      setMany: jest.fn(),
      deleteMany: jest.fn(),
      getTtl: jest.fn(),
      keys: jest.fn(),
    };

    middleware = new RequestLoggerMiddleware(mockCache as any);
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('일반 요청 → 캐시에 로그 저장', async () => {
    const req = createMockReq('/api/v1/data');
    const res = createMockRes(200);

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    // Simulate response finish
    expect(finishCallback).not.toBeNull();
    await finishCallback!();

    // Wait for async logRequest to complete
    // The set call is within the async callback
    await new Promise(resolve => setImmediate(resolve));

    expect(mockCache.get).toHaveBeenCalledWith(
      expect.stringContaining(REQUEST_LOG_PREFIX),
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining(REQUEST_LOG_PREFIX),
      expect.arrayContaining([
        expect.objectContaining({
          e: '/api/v1/data',
          m: 'GET',
          s: 200,
          t: expect.any(Number),
        }),
      ]),
      REQUEST_LOG_TTL,
    );
  });

  it('/health 경로 → 로깅 스킵 (next() 호출만)', () => {
    const req = createMockReq('/health');
    const res = createMockRes();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('/favicon.ico → 로깅 스킵', () => {
    const req = createMockReq('/favicon.ico');
    const res = createMockRes();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('ring buffer: 200개 초과 시 오래된 항목 제거', async () => {
    // Simulate 200 existing entries in cache
    const existingLogs = Array.from({ length: MAX_ENTRIES_PER_IP }, (_, i) => ({
      t: 1000 + i,
      e: '/old',
      m: 'GET',
      s: 200,
    }));
    mockCache.get.mockResolvedValue(existingLogs);

    const req = createMockReq('/api/new');
    const res = createMockRes(201);

    middleware.use(req, res, next);
    await finishCallback!();
    await new Promise(resolve => setImmediate(resolve));

    expect(mockCache.set).toHaveBeenCalledTimes(1);
    const savedLogs = mockCache.set.mock.calls[0][1];
    expect(savedLogs).toHaveLength(MAX_ENTRIES_PER_IP);
    // The newest entry should be at the end
    expect(savedLogs[savedLogs.length - 1].e).toBe('/api/new');
    // The oldest entry should have been removed (t=1000 gone, t=1001 is first)
    expect(savedLogs[0].t).toBe(1001);
  });

  it('캐시 에러 → 에러 로그 출력 (요청은 정상 진행)', async () => {
    mockCache.get.mockRejectedValue(new Error('Cache unavailable'));
    const debugSpy = jest.spyOn((middleware as any).logger, 'debug').mockImplementation();

    const req = createMockReq('/api/data');
    const res = createMockRes(200);

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    // Trigger finish and wait for the async error handling
    await finishCallback!();
    await new Promise(resolve => setImmediate(resolve));

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Request log failed'),
    );
  });
});
