/* eslint-disable @typescript-eslint/no-require-imports */

// Mock canvas before importing the service
jest.mock('canvas', () => ({
  createCanvas: jest.fn(() => ({
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      bezierCurveTo: jest.fn(),
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
    }),
    toBuffer: jest.fn(() => Buffer.from('fake-png-data')),
  })),
}));

import { PuzzleCaptchaService } from './puzzle-captcha.service';
import { ThreatScoreService } from './threat-score.service';

const CHARS = 'ABCDEFGHJKMNPQRTUVWXY346789';

describe('PuzzleCaptchaService', () => {
  let service: PuzzleCaptchaService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    getAndDelete: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockThreatScore = {
    getScore: jest.fn(),
    recordViolation: jest.fn().mockResolvedValue({}),
  };

  const mockIpBlacklist = {
    blockIp: jest.fn().mockResolvedValue(undefined),
  };

  const mockSecurityEvent = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PuzzleCaptchaService(
      mockCache as any,
      mockThreatScore as any,
      mockIpBlacklist as any,
      mockSecurityEvent as any,
    );
  });

  describe('shouldShowPuzzle', () => {
    it('임계값 0 → 모든 점수에서 true', async () => {
      mockThreatScore.getScore.mockResolvedValue({ totalScore: 20 });

      expect(await service.shouldShowPuzzle('1.2.3.4')).toBe(true);
    });

    it('높은 위협 점수 → true', async () => {
      mockThreatScore.getScore.mockResolvedValue({ totalScore: 30 });

      expect(await service.shouldShowPuzzle('1.2.3.4')).toBe(true);
    });

    it('점수가 null → true (0 >= 0)', async () => {
      mockThreatScore.getScore.mockResolvedValue(null);

      expect(await service.shouldShowPuzzle('1.2.3.4')).toBe(true);
    });

    it('getScore 에러 → false', async () => {
      mockThreatScore.getScore.mockRejectedValue(new Error('fail'));

      expect(await service.shouldShowPuzzle('1.2.3.4')).toBe(false);
    });
  });

  describe('generatePuzzle', () => {
    it('ID + gridImage + options 반환', async () => {
      const result = await service.generatePuzzle('1.2.3.4');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('gridImage');
      expect(result).toHaveProperty('options');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.gridImage).toContain('data:image/png;base64,');
      expect(result.options).toEqual([]);
    });

    it('캐시에 정답 저장 확인', async () => {
      await service.generatePuzzle('1.2.3.4');

      expect(mockCache.set).toHaveBeenCalledTimes(1);
      const [key, data, ttl] = mockCache.set.mock.calls[0];
      expect(key).toMatch(/^captcha:/);
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('ip', '1.2.3.4');
      expect(data).toHaveProperty('createdAt');
      expect(typeof data.answer).toBe('string');
      expect(data.answer.length).toBe(6);
      expect(ttl).toBe(10);
    });
  });

  describe('verifyPuzzle', () => {
    function makeId(signature: string): string {
      const data = `${Date.now()}|1.2.3.4|abcdef|${signature}`;
      return Buffer.from(data).toString('base64');
    }

    it('정답 → true (case-insensitive)', async () => {
      const sig = 'test-sig-123';
      const id = makeId(sig);

      mockCache.getAndDelete.mockResolvedValue({
        answer: 'abcde',
        ip: '1.2.3.4',
        createdAt: Date.now(),
      });

      expect(await service.verifyPuzzle(id, 'ABCDE', '1.2.3.4')).toBe(true);
    });

    it('오답 → false', async () => {
      const sig = 'test-sig-456';
      const id = makeId(sig);

      mockCache.getAndDelete.mockResolvedValue({
        answer: 'abcde',
        ip: '1.2.3.4',
        createdAt: Date.now(),
      });

      expect(await service.verifyPuzzle(id, 'WRONG', '1.2.3.4')).toBe(false);
    });

    it('만료 → false', async () => {
      const sig = 'test-sig-789';
      const id = makeId(sig);

      mockCache.getAndDelete.mockResolvedValue({
        answer: 'abcde',
        ip: '1.2.3.4',
        createdAt: Date.now() - 20000, // 20s ago, TTL is 10s
      });

      expect(await service.verifyPuzzle(id, 'abcde', '1.2.3.4')).toBe(false);
    });

    it('재사용 (getAndDelete null) → false', async () => {
      const sig = 'test-sig-000';
      const id = makeId(sig);

      mockCache.getAndDelete.mockResolvedValue(null);

      expect(await service.verifyPuzzle(id, 'abcde', '1.2.3.4')).toBe(false);
    });
  });

  describe('generateRandomText', () => {
    it('6글자, CHARS에서만 생성', async () => {
      // generateRandomText is private, so test via generatePuzzle
      await service.generatePuzzle('1.2.3.4');

      const cachedData = mockCache.set.mock.calls[0][1];
      const answer = cachedData.answer.toUpperCase();

      expect(answer.length).toBe(6);
      for (const ch of answer) {
        expect(CHARS).toContain(ch);
      }
    });
  });
});
