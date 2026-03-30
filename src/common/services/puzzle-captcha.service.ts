import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { createCanvas } from 'canvas';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { ThreatScoreService } from './threat-score.service';
import { IpBlacklistService } from './ip-blacklist.service';
import { SecurityEventService } from './security-event.service';
import { RequestUtils } from '../utils/request.utils';

const PUZZLE_SECRET = process.env.PUZZLE_SECRET || (() => {
  const fallback = randomBytes(32).toString('hex');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PUZZLE_SECRET environment variable is required in production');
  }
  return fallback;
})();

const PUZZLE_TTL = 10; // 10 seconds
const PUZZLE_THRESHOLD = 0; // 모든 첫 방문자에게 CAPTCHA 표시
const CAPTCHA_LENGTH = 6; // number of characters (~28.5 bits entropy)
const MAX_CAPTCHA_FAILURES = 5; // 5번 틀리면 블랙리스트
const FAILURE_TTL = 900; // 15분 내 실패 횟수 추적

// 혼동 문자 제외 (0/O, 1/l/I, 5/S, 2/Z)
const CHARS = 'ABCDEFGHJKMNPQRTUVWXY346789';

interface CaptchaCacheData {
  answer: string;
  ip: string;
  createdAt: number;
}

/**
 * Image Text CAPTCHA Service
 * Canvas로 왜곡된 텍스트 이미지를 생성 — DOM에 텍스트 없음 (PNG only)
 * 봇: OCR 또는 Vision AI 필요 (비용 + 시간)
 * 사람: 5글자 읽고 입력 (10초 여유)
 */
@Injectable()
export class PuzzleCaptchaService {
  private readonly logger = new Logger(PuzzleCaptchaService.name);

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly threatScoreService: ThreatScoreService,
    @Inject(forwardRef(() => IpBlacklistService)) private readonly ipBlacklistService: IpBlacklistService,
    @Inject(forwardRef(() => SecurityEventService)) private readonly securityEventService: SecurityEventService,
  ) {}

  async shouldShowPuzzle(ip: string): Promise<boolean> {
    try {
      const score = await this.threatScoreService.getScore(ip);
      return (score?.totalScore ?? 0) >= PUZZLE_THRESHOLD;
    } catch {
      return false;
    }
  }

  /**
   * Generate a text CAPTCHA as PNG image (base64).
   * Returns puzzle id + image data (no text in DOM).
   */
  async generatePuzzle(ip: string): Promise<{
    id: string;
    gridImage: string;
    options: string[];
  }> {
    // Generate random text
    const answer = this.generateRandomText();

    // Generate HMAC-signed token
    const random = randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const data = `${timestamp}|${ip}|${random}`;
    const signature = createHmac('sha256', PUZZLE_SECRET)
      .update(data)
      .digest('hex');
    const id = Buffer.from(`${data}|${signature}`).toString('base64');

    // Store answer in cache (10s TTL, one-time use)
    const cacheKey = `captcha:${signature}`;
    const cacheData: CaptchaCacheData = {
      answer: answer.toLowerCase(),
      ip,
      createdAt: Date.now(),
    };
    await this.cache.set(cacheKey, cacheData, PUZZLE_TTL);

    // Render captcha image as base64 PNG
    const imageBase64 = this.renderCaptchaImage(answer);

    // Return as gridImage (reusing existing interface)
    // options is empty — text input instead of click selection
    return {
      id,
      gridImage: `data:image/png;base64,${imageBase64}`,
      options: [], // empty — text input mode
    };
  }

  /**
   * Verify captcha answer. Case-insensitive, one-time use.
   * 5번 틀리면 IP 블랙리스트.
   */
  async verifyPuzzle(
    id: string,
    selectedIndex: number | string,
    ip: string,
  ): Promise<boolean> {
    try {
      const decoded = Buffer.from(id, 'base64').toString();
      const parts = decoded.split('|');
      if (parts.length < 4) {
        await this.recordFailure(ip);
        return false;
      }

      const signature = parts[3];
      const cacheKey = `captcha:${signature}`;
      const cached = await this.cache.getAndDelete<CaptchaCacheData>(cacheKey);
      if (!cached) {
        await this.recordFailure(ip);
        return false;
      }

      // Verify time limit
      if (Date.now() - cached.createdAt > PUZZLE_TTL * 1000) {
        await this.recordFailure(ip);
        return false;
      }

      // Verify answer (case-insensitive)
      const userAnswer = String(selectedIndex).toLowerCase().trim();
      if (userAnswer !== cached.answer) {
        await this.recordFailure(ip);
        return false;
      }

      // 성공 시 실패 카운터 초기화
      await this.cache.delete(`captcha_fail:${RequestUtils.normalizeIp(ip)}`);
      this.logger.log('Text CAPTCHA solved successfully');
      return true;
    } catch (error) {
      this.logger.error('CAPTCHA verification failed', error);
      return false;
    }
  }

  /**
   * CAPTCHA 실패 기록. 5번 초과 시 IP 블랙리스트.
   */
  private async recordFailure(ip: string): Promise<void> {
    try {
      const key = `captcha_fail:${RequestUtils.normalizeIp(ip)}`;
      const count = (await this.cache.get<number>(key)) || 0;
      const newCount = count + 1;
      await this.cache.set(key, newCount, FAILURE_TTL);

      this.logger.warn(`CAPTCHA failure #${newCount} for IP: ${RequestUtils.hashIp(ip, 'log')}`);

      if (newCount >= MAX_CAPTCHA_FAILURES) {
        this.logger.warn(`CAPTCHA failures exceeded (${newCount}) — blocking IP`);

        await this.ipBlacklistService.blockIp(ip, 'CAPTCHA_FAILURES', 3600);

        this.securityEventService.log({
          eventType: 'AUTO_BLOCKED',
          severity: 'HIGH',
          ip,
          description: `Auto-blocked: ${newCount} CAPTCHA failures in ${FAILURE_TTL / 60} minutes`,
        }).catch(err => this.logger.error('Failed to log CAPTCHA block event', err?.message));

        this.threatScoreService.recordViolation(ip, 'SUSPICIOUS_ACTIVITY', 'CRITICAL')
          .catch(err => this.logger.error('Failed to record CAPTCHA threat violation', err?.message));
      }
    } catch (err) {
      this.logger.error('Failed to record CAPTCHA failure', err);
    }
  }

  /**
   * Generate random captcha text (혼동 문자 제외)
   */
  private generateRandomText(): string {
    let text = '';
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
      const byte = randomBytes(1)[0];
      text += CHARS[byte % CHARS.length];
    }
    return text;
  }

  /**
   * Render captcha text as a distorted PNG image using Canvas.
   * - 글자마다 랜덤 회전, 크기, 색상, y 오프셋
   * - 노이즈 라인 10~15개 (글자와 비슷한 색상)
   * - 배경 점 노이즈
   * - 결과: base64 PNG (DOM에 텍스트 없음)
   */
  private renderCaptchaImage(text: string): string {
    const width = 300;
    const height = 90;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // 배경 점 노이즈
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = this.randomNeonColor(0.15);
      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 3 + 0.5,
        0, Math.PI * 2,
      );
      ctx.fill();
    }

    // 노이즈 라인 (글자와 비슷한 색상으로)
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = this.randomNeonColor(0.3);
      ctx.lineWidth = Math.random() * 2 + 0.5;
      ctx.beginPath();
      if (Math.random() > 0.5) {
        // 직선
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
      } else {
        // 곡선
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.bezierCurveTo(
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height,
        );
      }
      ctx.stroke();
    }

    // 글자 렌더링
    const charWidth = width / (text.length + 1);
    const neonColors = ['#00ff88', '#00d4ff', '#ff9f43', '#ff4757', '#a55eea', '#e4e8f1'];
    const fonts = ['bold {size}px monospace', 'bold {size}px serif', 'bold {size}px sans-serif', 'italic bold {size}px Georgia'];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = charWidth * (i + 0.5) + (Math.random() - 0.5) * 10;
      const y = height / 2 + (Math.random() - 0.5) * 16;
      const fontSize = 32 + Math.floor(Math.random() * 12);
      const rotation = (Math.random() - 0.5) * 0.5; // -15° ~ +15°

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // 글자 색상 (네온)
      const color = neonColors[Math.floor(Math.random() * neonColors.length)];
      ctx.fillStyle = color;
      const font = fonts[Math.floor(Math.random() * fonts.length)].replace('{size}', fontSize.toString());
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 약간의 그림자
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.fillText(char, 0, 0);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // 전경 노이즈 라인 (글자 위에 겹침)
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = this.randomNeonColor(0.25);
      ctx.lineWidth = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.bezierCurveTo(
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height,
      );
      ctx.stroke();
    }

    return canvas.toBuffer('image/png').toString('base64');
  }

  /**
   * Generate random neon color with opacity
   */
  private randomNeonColor(opacity: number): string {
    const colors = [
      [0, 255, 136],   // green
      [0, 212, 255],   // cyan
      [255, 159, 67],  // amber
      [255, 71, 87],   // red
      [165, 94, 234],  // purple
      [228, 232, 241], // white
    ];
    const [r, g, b] = colors[Math.floor(Math.random() * colors.length)];
    return `rgba(${r},${g},${b},${opacity})`;
  }
}
