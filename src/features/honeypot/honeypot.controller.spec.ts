import { HoneypotController } from './honeypot.controller';

describe('HoneypotController', () => {
  let controller: HoneypotController;
  let mockSecurityEventService: Record<string, jest.Mock>;
  let mockThreatScoreService: Record<string, jest.Mock>;

  const mockRequest = {
    ip: '192.168.1.100',
    headers: {
      'user-agent': 'test-bot/1.0',
      accept: 'application/json',
      referer: 'https://evil.com',
      origin: 'https://evil.com',
    },
  } as any;

  beforeEach(() => {
    mockSecurityEventService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    mockThreatScoreService = {
      recordViolation: jest.fn().mockResolvedValue({}),
    };

    controller = new HoneypotController(
      mockSecurityEventService as any,
      mockThreatScoreService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/internal/users → ResponseBuilder 포맷 반환 확인', async () => {
    const result = await controller.getInternalUsers(mockRequest);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        data: expect.any(Array),
        message: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(result.data).toHaveLength(5);
    expect(result.data[0]).toHaveProperty('username', 'admin');
  });

  it('GET /api/internal/config → ResponseBuilder 포맷 반환 확인', async () => {
    const result = await controller.getInternalConfig(mockRequest);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          appName: 'internal-api-service',
          version: '1.2.0',
          features: expect.any(Object),
        }),
        message: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it('GET /api/v2/data → ResponseBuilder 포맷 반환 확인', async () => {
    const result = await controller.getV2Data(mockRequest);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          items: expect.any(Array),
          pagination: expect.objectContaining({ total: 3 }),
        }),
        message: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it('허니팟 접근 시 SecurityEventService.log 호출 확인 (HONEYPOT_TRIGGERED)', async () => {
    await controller.getInternalUsers(mockRequest);

    expect(mockSecurityEventService.log).toHaveBeenCalledTimes(1);
    expect(mockSecurityEventService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'HONEYPOT_TRIGGERED',
        severity: 'HIGH',
        ip: '192.168.1.100',
        userAgent: 'test-bot/1.0',
        endpoint: 'api/internal/users',
        method: 'GET',
        description: expect.stringContaining('Honeypot endpoint accessed'),
      }),
    );
  });

  it('허니팟 접근 시 ThreatScoreService.recordViolation 호출 확인 (HIGH)', async () => {
    await controller.getV2Data(mockRequest);

    expect(mockThreatScoreService.recordViolation).toHaveBeenCalledTimes(1);
    expect(mockThreatScoreService.recordViolation).toHaveBeenCalledWith(
      '192.168.1.100',
      'HONEYPOT_TRIGGERED',
      'HIGH',
    );
  });
});
