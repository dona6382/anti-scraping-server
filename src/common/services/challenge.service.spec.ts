import { createHash } from 'crypto';
import { ChallengeService, COOKIE_TTL } from './challenge.service';

describe('ChallengeService', () => {
  let service: ChallengeService;
  let mockCache: Record<string, jest.Mock>;
  let mockSecurityEvent: Record<string, jest.Mock>;
  let mockThreatScore: Record<string, jest.Mock>;

  const TEST_IP = '192.168.1.100';
  const SAME_SUBNET_IP = '192.168.1.200';
  const DIFFERENT_SUBNET_IP = '10.0.0.1';
  const TEST_FINGERPRINT = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  beforeAll(() => {
    process.env.CHALLENGE_SECRET = 'test-secret';
  });

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
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

    mockThreatScore = {
      getScore: jest.fn().mockResolvedValue(null),
      recordViolation: jest.fn().mockResolvedValue({}),
    };
    mockSecurityEvent = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    service = new ChallengeService(mockCache as any, mockThreatScore as any, mockSecurityEvent as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper: solve PoW for a given token with difficulty 4 (default)
  function solvePoW(token: string, difficulty = 4): string {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    while (true) {
      const hash = createHash('sha256')
        .update(token + nonce)
        .digest('hex');
      if (hash.startsWith(prefix)) return nonce.toString();
      nonce++;
    }
  }

  describe('generateToken()', () => {
    it('토큰 생성 시 Base64 인코딩된 문자열 반환', async () => {
      const token = await service.generateToken(TEST_IP);

      expect(typeof token).toBe('string');
      // Valid base64 should not throw when decoded
      const decoded = Buffer.from(token, 'base64').toString();
      expect(decoded.length).toBeGreaterThan(0);
      // Re-encoding should match (valid base64 roundtrip)
      expect(Buffer.from(decoded).toString('base64')).toBe(token);
    });

    it('토큰 디코딩 시 timestamp|ip|random|signature 형식', async () => {
      const token = await service.generateToken(TEST_IP);
      const decoded = Buffer.from(token, 'base64').toString();
      const parts = decoded.split('|');

      expect(parts.length).toBe(4);
      // timestamp should be a number
      expect(Number(parts[0])).not.toBeNaN();
      // ip should be the normalized IP
      expect(parts[1]).toBe(TEST_IP);
      // random should be 32 hex chars (16 bytes)
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
      // signature should be a hex string (64 chars for sha256)
      expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('캐시에 challenge:signature = pending 저장 확인', async () => {
      const token = await service.generateToken(TEST_IP);
      const decoded = Buffer.from(token, 'base64').toString();
      const signature = decoded.split('|')[3];

      expect(mockCache.set).toHaveBeenCalledWith(
        `challenge:${signature}`,
        'pending',
        expect.any(Number),
      );
    });

    it('캐시 TTL 30초 확인', async () => {
      await service.generateToken(TEST_IP);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^challenge:/),
        'pending',
        30,
      );
    });

    it('IPv6 주소(::1)로 토큰 생성 및 검증', async () => {
      const IPV6_IP = '::1';
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const token = await service.generateToken(IPV6_IP);
      const nonce = solvePoW(token);
      mockCache.getAndDelete.mockResolvedValue('pending');

      const result = await service.verifyChallenge(token, nonce, IPV6_IP);
      expect(result).toBe(true);
    });
  });

  describe('verifyChallenge()', () => {
    let validToken: string;
    let validNonce: string;

    beforeEach(async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      validToken = await service.generateToken(TEST_IP);
      validNonce = solvePoW(validToken);
      mockCache.getAndDelete.mockResolvedValue('pending');
    });

    it('유효한 토큰 + 올바른 nonce + 같은 IP -> true', async () => {
      const result = await service.verifyChallenge(validToken, validNonce, TEST_IP);
      expect(result).toBe(true);
    });

    it('서명 변조된 토큰 -> false', async () => {
      const decoded = Buffer.from(validToken, 'base64').toString();
      const parts = decoded.split('|');
      parts[3] = 'a'.repeat(64); // tampered signature
      const tamperedToken = Buffer.from(parts.join('|')).toString('base64');

      const result = await service.verifyChallenge(tamperedToken, validNonce, TEST_IP);
      expect(result).toBe(false);
    });

    it('만료된 토큰 (30초 초과) -> false', async () => {
      // Token was generated at 1000000. Move time forward by 31 seconds.
      (Date.now as jest.Mock).mockReturnValue(1000000 + 31000);

      const result = await service.verifyChallenge(validToken, validNonce, TEST_IP);
      expect(result).toBe(false);
    });

    it('다른 /24 서브넷 IP -> false', async () => {
      const result = await service.verifyChallenge(validToken, validNonce, DIFFERENT_SUBNET_IP);
      expect(result).toBe(false);
    });

    it('이미 사용된 토큰 (캐시에서 삭제됨) -> false', async () => {
      mockCache.getAndDelete.mockResolvedValue(null);

      const result = await service.verifyChallenge(validToken, validNonce, TEST_IP);
      expect(result).toBe(false);
    });

    it('잘못된 PoW nonce -> false', async () => {
      const result = await service.verifyChallenge(validToken, 'invalid-nonce', TEST_IP);
      expect(result).toBe(false);
    });

    it('잘못된 Base64 -> false', async () => {
      const result = await service.verifyChallenge('!!!not-valid-base64!!!', '0', TEST_IP);
      expect(result).toBe(false);
    });

    it('파트 수 부족 -> false', async () => {
      const shortToken = Buffer.from('only|two|parts').toString('base64');
      const result = await service.verifyChallenge(shortToken, '0', TEST_IP);
      expect(result).toBe(false);
    });
  });

  describe('generateCookie() + verifyCookie()', () => {
    it('같은 IP로 생성/검증 -> true', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const result = service.verifyCookie(cookie, TEST_IP);
      expect(result).toBe(true);
    });

    it('같은 /24 서브넷 IP로 생성/검증 -> true', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const result = service.verifyCookie(cookie, SAME_SUBNET_IP);
      expect(result).toBe(true);
    });

    it('서명 변조 -> false', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const parts = cookie.split(':');
      parts[3] = 'a'.repeat(32); // tampered signature
      const tampered = parts.join(':');

      const result = service.verifyCookie(tampered, TEST_IP);
      expect(result).toBe(false);
    });

    it('다른 /24 서브넷 -> false', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const result = service.verifyCookie(cookie, DIFFERENT_SUBNET_IP);
      expect(result).toBe(false);
    });

    it('만료된 쿠키 (24시간 초과) -> false', () => {
      const now = 1000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);

      // Move forward past 24 hours
      (Date.now as jest.Mock).mockReturnValue(now + COOKIE_TTL * 1000 + 1);
      const result = service.verifyCookie(cookie, TEST_IP);
      expect(result).toBe(false);
    });

    it('잘못된 형식 (파트 수 부족) -> false', () => {
      const result = service.verifyCookie('only:two:parts', TEST_IP);
      expect(result).toBe(false);
    });

    it('HMAC 길이 = 64 hex chars 확인 (full SHA-256)', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const parts = cookie.split(':');
      const signature = parts[3];

      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('safeCompare() (private, tested via public methods)', () => {
    it('올바른 서명 -> pass (verifyCookie 통해)', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      expect(service.verifyCookie(cookie, TEST_IP)).toBe(true);
    });

    it('틀린 서명 -> fail (verifyCookie 통해)', () => {
      const cookie = service.generateCookie(TEST_IP, TEST_FINGERPRINT);
      const parts = cookie.split(':');
      // Change one character in the signature
      const originalSig = parts[3];
      const wrongChar = originalSig[0] === 'a' ? 'b' : 'a';
      parts[3] = wrongChar + originalSig.substring(1);
      const tampered = parts.join(':');

      expect(service.verifyCookie(tampered, TEST_IP)).toBe(false);
    });
  });

  describe('storeFingerprint()', () => {
    it('새 핑거프린트 저장 확인 (subnets, rawIps 포함)', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.storeFingerprint(TEST_FINGERPRINT, TEST_IP);

      expect(mockCache.set).toHaveBeenCalledWith(
        `fp:${TEST_FINGERPRINT}`,
        expect.objectContaining({
          ips: expect.any(Array),
          subnets: expect.any(Array),
          rawIps: expect.any(Array),
          count: 1,
        }),
        COOKIE_TTL,
      );

      const savedData = mockCache.set.mock.calls[0][1];
      expect(savedData.ips).toHaveLength(1);
      expect(savedData.subnets).toHaveLength(1);
      expect(savedData.subnets[0]).toBe('192.168.1');
      expect(savedData.rawIps).toHaveLength(1);
      expect(savedData.rawIps[0]).toBe(TEST_IP);
    });

    it('같은 핑거프린트 + 다른 IP -> IP 및 서브넷 추가', async () => {
      const existingHashedIp = 'existing-hashed-ip';
      mockCache.get.mockResolvedValue({
        ips: [existingHashedIp],
        subnets: ['192.168.1'],
        rawIps: ['192.168.1.100'],
        count: 1,
      });

      await service.storeFingerprint(TEST_FINGERPRINT, DIFFERENT_SUBNET_IP);

      expect(mockCache.set).toHaveBeenCalledWith(
        `fp:${TEST_FINGERPRINT}`,
        expect.objectContaining({
          ips: expect.arrayContaining([existingHashedIp]),
          subnets: expect.arrayContaining(['192.168.1', '10.0.0']),
          count: 2,
        }),
        COOKIE_TTL,
      );

      const savedData = mockCache.set.mock.calls[0][1];
      expect(savedData.ips).toHaveLength(2);
      expect(savedData.subnets).toHaveLength(2);
    });

    it('3개 이하 서브넷 -> 이벤트 기록하지 않음', async () => {
      mockCache.get.mockResolvedValue({
        ips: ['hash1', 'hash2'],
        subnets: ['10.0.0', '10.0.1'],
        rawIps: ['10.0.0.1', '10.0.1.1'],
        count: 2,
      });

      await service.storeFingerprint(TEST_FINGERPRINT, '10.0.2.1');

      // 3 subnets (including the new one) is NOT > 3, so no event
      expect(mockSecurityEvent.log).not.toHaveBeenCalled();
      expect(mockThreatScore.recordViolation).not.toHaveBeenCalled();
    });

    it('4개 이상 서브넷 -> SUSPICIOUS_ACTIVITY 이벤트 + 위협 점수 기록', async () => {
      mockCache.get.mockResolvedValue({
        ips: ['hash1', 'hash2', 'hash3'],
        subnets: ['10.0.0', '10.0.1', '10.0.2'],
        rawIps: ['10.0.0.1', '10.0.1.1', '10.0.2.1'],
        count: 3,
      });

      await service.storeFingerprint(TEST_FINGERPRINT, '172.16.0.1');

      // 4 subnets > 3 -> should log event
      expect(mockSecurityEvent.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'HIGH',
          description: 'Same fingerprint from multiple subnets',
        }),
      );

      // Should record violation for all associated IPs
      expect(mockThreatScore.recordViolation).toHaveBeenCalledTimes(4);
      expect(mockThreatScore.recordViolation).toHaveBeenCalledWith(
        '10.0.0.1', 'SUSPICIOUS_ACTIVITY', 'HIGH',
      );
      expect(mockThreatScore.recordViolation).toHaveBeenCalledWith(
        '172.16.0.1', 'SUSPICIOUS_ACTIVITY', 'HIGH',
      );
    });

    it('기존 데이터에 subnets/rawIps 없으면 빈 배열로 폴백', async () => {
      // Legacy data without subnets/rawIps fields
      mockCache.get.mockResolvedValue({
        ips: ['hash1'],
        count: 1,
      });

      await service.storeFingerprint(TEST_FINGERPRINT, TEST_IP);

      const savedData = mockCache.set.mock.calls[0][1];
      expect(savedData.subnets).toHaveLength(1);
      expect(savedData.rawIps).toHaveLength(1);
    });
  });

  describe('getChallengeHtml()', () => {
    it('HTML에 토큰과 난이도 포함 확인', () => {
      const token = 'test-token-value';
      const difficulty = 3;
      const html = service.getChallengeHtml(token, difficulty);

      expect(html).toContain('test-token-value');
      expect(html).toContain('var difficulty = 3');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Security Check');
    });

    it('XSS 방지: 토큰이 JSON.stringify로 이스케이프됨 확인', () => {
      const maliciousToken = '</script><script>alert("xss")</script>';
      const html = service.getChallengeHtml(maliciousToken, 3);

      // The token should be JSON.stringify'd and </ should be escaped to \u003c
      expect(html).not.toContain('</script><script>');
      expect(html).toContain('\\u003c');
    });
  });

  describe('getDifficulty()', () => {
    it('항상 난이도 4 (퍼즐 캡챠가 핵심 방어)', async () => {
      const difficulty = await service.getDifficulty(TEST_IP);
      expect(difficulty).toBe(4);
    });
  });
});
