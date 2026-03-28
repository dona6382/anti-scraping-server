import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestUtils } from '../utils/request.utils';
import { ThreatScoreService } from './threat-score.service';
import { SecurityEventService } from './security-event.service';

const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET || (() => {
  const fallback = randomBytes(32).toString('hex');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CHALLENGE_SECRET environment variable is required in production');
  }
  return fallback;
})();
const TOKEN_TTL = 30; // 30 seconds
export const COOKIE_TTL = 900; // 15분 (봇이 자주 PoW를 다시 풀도록)
const PROXY_ROTATION_SUBNET_THRESHOLD = 3; // >3 unique subnets triggers alert

export interface FingerprintData {
  ips: string[];       // hashed IPs
  subnets: string[];   // /24 subnets (plain, for comparison)
  rawIps: string[];    // raw IPs (for threat score recording)
  count: number;       // total request count
}

/**
 * Challenge Service
 * JS Challenge + Browser Fingerprint 기반 봇 차단 서비스
 */
@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    @Inject(forwardRef(() => ThreatScoreService)) private readonly threatScoreService: ThreatScoreService,
    @Inject(forwardRef(() => SecurityEventService)) private readonly securityEventService: SecurityEventService,
  ) {}

  /**
   * 일회용 챌린지 토큰 생성
   */
  async generateToken(ip: string): Promise<string> {
    const timestamp = Date.now().toString();
    const random = randomBytes(16).toString('hex');
    const normalizedIp = RequestUtils.normalizeIp(ip);
    const data = `${timestamp}|${normalizedIp}|${random}`;
    const signature = createHmac('sha256', CHALLENGE_SECRET)
      .update(data)
      .digest('hex');
    const token = Buffer.from(`${data}|${signature}`).toString('base64');

    // 토큰을 pending 상태로 캐시에 저장 (TTL 30s)
    await this.cache.set(`challenge:${signature}`, 'pending', TOKEN_TTL);
    return token;
  }

  /**
   * PoW 솔루션 검증
   */
  async verifyChallenge(
    token: string,
    nonce: string,
    ip: string,
  ): Promise<boolean> {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const parts = decoded.split('|');
      if (parts.length < 4) return false;

      const [timestamp, tokenIp, random, signature] = [
        parts[0],
        parts[1],
        parts[2],
        parts[3],
      ];

      // 서명 검증 (timing-safe)
      const data = `${timestamp}|${tokenIp}|${random}`;
      const expectedSig = createHmac('sha256', CHALLENGE_SECRET)
        .update(data)
        .digest('hex');
      if (!this.safeCompare(signature, expectedSig)) return false;

      // TTL 검증 (30s)
      if (Date.now() - parseInt(timestamp) > TOKEN_TTL * 1000) return false;

      // IP 서브넷 검증 (같은 /24)
      const normalizedIp = RequestUtils.normalizeIp(ip);
      if (!this.isSameSubnet(tokenIp, normalizedIp)) return false;

      // 일회용 검증 (atomic getAndDelete로 TOCTOU 방지)
      const key = `challenge:${signature}`;
      const status = await this.cache.getAndDelete<string>(key);
      if (status !== 'pending') return false;

      // PoW 검증
      const hash = createHash('sha256')
        .update(token + nonce)
        .digest('hex');
      const difficulty = await this.getDifficulty(ip);
      const prefix = '0'.repeat(difficulty);
      return hash.startsWith(prefix);
    } catch (error) {
      this.logger.error('Challenge verification failed', error);
      return false;
    }
  }

  /**
   * 서명된 쿠키 값 생성
   */
  generateCookie(ip: string, fingerprint: string): string {
    const subnet = this.getSubnet(ip);
    const fpTruncated = fingerprint.substring(0, 32);
    const data = `${Date.now()}:${subnet}:${fpTruncated}`;
    const signature = createHmac('sha256', CHALLENGE_SECRET)
      .update(data)
      .digest('hex')
      .substring(0, 32); // 128-bit (32 hex chars)
    return `${data}:${signature}`;
  }

  /**
   * 쿠키 검증
   */
  verifyCookie(cookieValue: string, ip: string): boolean {
    try {
      const parts = cookieValue.split(':');
      if (parts.length < 4) return false;

      const [timestamp, subnet, fp, signature] = [
        parts[0],
        parts[1],
        parts[2],
        parts[3],
      ];

      // 서명 검증 (timing-safe)
      const data = `${timestamp}:${subnet}:${fp}`;
      const expectedSig = createHmac('sha256', CHALLENGE_SECRET)
        .update(data)
        .digest('hex')
        .substring(0, 32); // 128-bit
      if (!this.safeCompare(signature, expectedSig)) return false;

      // 만료 검증 (1h)
      if (Date.now() - parseInt(timestamp) > COOKIE_TTL * 1000) return false;

      // 같은 /24 서브넷 검증
      return this.getSubnet(ip) === subnet;
    } catch {
      return false;
    }
  }

  /**
   * PoW 난이도 결정 — 위협 점수에 따라 적응형 조정
   * 기본 5 (1M 해시), 위협 높을수록 6~7
   * 브라우저: ~500ms(5), ~8s(6), ~2min(7)
   * Node.js: ~50ms(5), ~500ms(6), ~5s(7)
   */
  async getDifficulty(ip: string): Promise<number> {
    try {
      const score = await this.threatScoreService.getScore(ip);
      const totalScore = score?.totalScore ?? 0;
      if (totalScore >= 50) return 7; // ~268M hashes — 봇에게 ~5s, 브라우저 ~2min
      if (totalScore >= 30) return 6; // ~16M hashes — 봇에게 ~500ms, 브라우저 ~8s
      return 5; // ~1M hashes — 봇에게 ~50ms, 브라우저 ~500ms (기본)
    } catch {
      return 5;
    }
  }

  /**
   * 핑거프린트 저장 (추적용) + 프록시 로테이션 탐지
   * 같은 핑거프린트가 3개 이상의 /24 서브넷에서 관측되면 의심 활동으로 기록
   */
  async storeFingerprint(fingerprint: string, ip: string): Promise<void> {
    const key = `fp:${fingerprint}`;
    const existing = await this.cache.get<FingerprintData>(key);
    const ips = existing?.ips || [];
    const subnets = existing?.subnets || [];
    const rawIps = existing?.rawIps || [];
    const hashedIp = RequestUtils.hashIp(ip, 'fp');
    if (!ips.includes(hashedIp)) ips.push(hashedIp);

    const subnet = this.getSubnet(ip);
    if (!subnets.includes(subnet)) subnets.push(subnet);
    if (!rawIps.includes(ip)) rawIps.push(ip);

    await this.cache.set(
      key,
      { ips, subnets, rawIps, count: (existing?.count || 0) + 1 },
      COOKIE_TTL,
    );

    // Proxy rotation detection: >3 unique /24 subnets
    if (subnets.length > PROXY_ROTATION_SUBNET_THRESHOLD) {
      this.logger.warn(
        `Proxy rotation detected for fingerprint ${fingerprint.substring(0, 8)}...: ${subnets.length} subnets`,
      );

      this.securityEventService.log({
        eventType: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        ip,
        description: 'Same fingerprint from multiple subnets',
        eventData: {
          fingerprint: fingerprint.substring(0, 16),
          uniqueSubnets: subnets.length,
          uniqueIps: ips.length,
          totalRequests: (existing?.count || 0) + 1,
        },
      }).catch(err => this.logger.error('Failed to log proxy rotation event', err?.message));

      // Record threat score violation for all associated IPs
      for (const associatedIp of rawIps) {
        this.threatScoreService.recordViolation(
          associatedIp,
          'SUSPICIOUS_ACTIVITY',
          'HIGH',
        ).catch(err => this.logger.error('Failed to record threat violation', err?.message));
      }
    }
  }

  /**
   * 챌린지 HTML 페이지 생성
   */
  getChallengeHtml(token: string, difficulty: number): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Security Check</title>
<style>
  body { background: #0a0e17; color: #e4e8f1; font-family: -apple-system, sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { text-align: center; }
  .spinner { width: 40px; height: 40px; border: 3px solid #2a3a4e; border-top-color: #00ff88;
             border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h2 { color: #00ff88; font-size: 1.2rem; }
  p { color: #8892a4; font-size: 0.9rem; }
</style></head>
<body><div class="box">
  <div class="spinner"></div>
  <h2>Checking your browser...</h2>
  <p>This will only take a moment.</p>
</div>
<script>
(async function() {
  var token = ${JSON.stringify(token).replace(/</g, '\\u003c')};
  var difficulty = ${Number(difficulty)};

  // 1. 브라우저 핑거프린트 생성
  var fp = await generateFingerprint();

  // 2. PoW 풀기
  var nonce = await solvePoW(token, difficulty);

  // 3. Hidden form으로 제출 (Set-Cookie가 확실히 적용되도록 form submit + 서버 redirect)
  var form = document.createElement('form');
  form.method = 'POST';
  form.action = '/challenge/verify';
  function addField(name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  addField('token', token);
  addField('nonce', nonce.toString());
  addField('fingerprint', fp);
  addField('returnUrl', window.location.href);
  document.body.appendChild(form);
  form.submit();

  async function generateFingerprint() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    var canvasHash = canvas.toDataURL().slice(-32);

    var data = [
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency,
      navigator.deviceMemory || 'unknown',
      canvasHash,
      navigator.platform
    ].join('|');

    var encoder = new TextEncoder();
    var hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function solvePoW(token, difficulty) {
    var prefix = '0'.repeat(difficulty);
    var encoder = new TextEncoder();
    var nonce = 0;
    while (true) {
      var data = token + nonce;
      var hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      var hash = Array.from(new Uint8Array(hashBuffer)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      if (hash.startsWith(prefix)) return nonce;
      nonce++;
      if (nonce % 1000 === 0) await new Promise(function(r) { setTimeout(r, 0); });
    }
  }
})();
</script></body></html>`;
  }

  /**
   * /24 서브넷 추출
   */
  private getSubnet(ip: string): string {
    const parts = RequestUtils.normalizeIp(ip).split('.');
    if (parts.length === 4) return parts.slice(0, 3).join('.');
    return ip; // IPv6 fallback
  }

  /**
   * 같은 /24 서브넷인지 확인
   */
  private isSameSubnet(ip1: string, ip2: string): boolean {
    return this.getSubnet(ip1) === this.getSubnet(ip2);
  }

  /**
   * Timing-safe 문자열 비교 (side-channel 방어)
   */
  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
