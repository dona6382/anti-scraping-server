import { ExecutionContext } from '@nestjs/common';
import { TlsFingerprintGuard } from './tls-fingerprint.guard';
import { SecurityEventService } from '../services/security-event.service';
import { ThreatScoreService } from '../services/threat-score.service';

describe('TlsFingerprintGuard', () => {
  let guard: TlsFingerprintGuard;

  const mockSecurityEvent = {
    log: jest.fn(),
  };

  const mockThreatScore = {
    recordViolation: jest.fn().mockResolvedValue(undefined),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  function createMockContext(
    headers: Record<string, string> = {},
    ip = '10.0.0.1',
  ): ExecutionContext {
    const handler = () => ({});
    const cls = class {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'user-agent': 'Mozilla/5.0 Test',
            ...headers,
          },
          url: '/api/test',
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
    jest.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockThreatScore.recordViolation.mockResolvedValue(undefined);

    guard = new TlsFingerprintGuard(
      mockSecurityEvent as unknown as SecurityEventService,
      mockThreatScore as unknown as ThreatScoreService,
      mockReflector as any,
    );
  });

  it('SkipTlsFingerprint 데코레이터 → 통과', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext({
      'x-tls-fingerprint': 'TLSv1.2:AES128-SHA',
    });

    expect(await guard.canActivate(context)).toBe(true);
    expect(mockSecurityEvent.log).not.toHaveBeenCalled();
  });

  it('X-TLS-Fingerprint 헤더 없음 → fail-open 통과', async () => {
    const context = createMockContext();

    expect(await guard.canActivate(context)).toBe(true);
    expect(mockSecurityEvent.log).not.toHaveBeenCalled();
  });

  it('알려진 브라우저 핑거프린트 → 통과 (이벤트 기록 없음)', async () => {
    const context = createMockContext({
      'x-tls-fingerprint': 'TLSv1.3:TLS_AES_256_GCM_SHA384',
    });

    expect(await guard.canActivate(context)).toBe(true);
    expect(mockSecurityEvent.log).not.toHaveBeenCalled();
    expect(mockThreatScore.recordViolation).not.toHaveBeenCalled();
  });

  it('의심스러운 핑거프린트 → 통과하지만 SecurityEvent + ThreatScore 기록', async () => {
    const context = createMockContext({
      'x-tls-fingerprint': 'TLSv1.2:AES128-SHA',
      'x-tls-version': 'TLSv1.2',
      'x-tls-cipher': 'AES128-SHA',
    });

    expect(await guard.canActivate(context)).toBe(true);

    expect(mockSecurityEvent.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
      }),
    );

    expect(mockThreatScore.recordViolation).toHaveBeenCalledWith(
      '10.0.0.1',
      'SUSPICIOUS_ACTIVITY',
      'MEDIUM',
    );
  });

  it('에러 시 → fail-open 통과', async () => {
    // Force an error by making headers access throw
    const handler = () => ({});
    const cls = class {};
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: new Proxy(
            {},
            {
              get: () => {
                throw new Error('Unexpected error');
              },
            },
          ),
          url: '/api/test',
          method: 'GET',
          ip: '10.0.0.1',
          connection: { remoteAddress: '10.0.0.1' },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;

    // The reflector check happens before headers access, so mock it to not skip
    mockReflector.getAllAndOverride.mockReturnValue(false);

    expect(await guard.canActivate(context)).toBe(true);
  });
});
