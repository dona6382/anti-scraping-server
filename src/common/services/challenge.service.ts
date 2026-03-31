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
// 쿠키 서명에는 별도 파생 키 사용 (키 분리 원칙)
const COOKIE_SIGN_KEY = createHmac('sha256', CHALLENGE_SECRET).update('cookie-signing-key').digest('hex');
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
    // 쿠키 크기 최적화: 64자 → 32자 (verifyCookie에서도 동일하게 비교하므로 안전)
    const fpTruncated = fingerprint.substring(0, 32);
    const data = `${Date.now()}:${subnet}:${fpTruncated}`;
    const signature = createHmac('sha256', COOKIE_SIGN_KEY)
      .update(data)
      .digest('hex');
    return `${data}:${signature}`;
  }

  /**
   * 쿠키 검증
   */
  verifyCookie(cookieValue: string, ip: string): boolean {
    try {
      const parts = cookieValue.split(':');
      if (parts.length !== 4) return false;

      const [timestamp, subnet, fp, signature] = parts;

      // 서명 검증 (timing-safe, 쿠키 전용 파생 키 사용)
      const data = `${timestamp}:${subnet}:${fp}`;
      const expectedSig = createHmac('sha256', COOKIE_SIGN_KEY)
        .update(data)
        .digest('hex');
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
   * PoW 난이도 결정
   * 일률적으로 4 (65K 해시, 브라우저 ~30ms)
   * 위협 점수 높을 때는 PoW가 아닌 퍼즐 캡챠가 핵심 방어
   */
  async getDifficulty(ip: string): Promise<number> {
    try {
      const score = await this.threatScoreService.getScore(ip);
      const totalScore = score?.totalScore ?? 0;
      if (totalScore >= 70) return 6; // ~16M hashes — 브라우저 ~5s (고위협)
      if (totalScore >= 30) return 5; // ~1M hashes — 브라우저 ~500ms (중위협)
      return 4; // ~65K hashes — 브라우저 ~30ms (기본)
    } catch {
      return 4;
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
   * GPU 봇 의심 — PoW 풀이 100ms 미만 시 위협 점수 기록
   */
  async recordFastSolve(ip: string): Promise<void> {
    this.threatScoreService.recordViolation(ip, 'FAST_POW_SOLVE', 'MEDIUM')
      .catch(err => this.logger.error('Failed to record fast solve violation', err?.message));
  }

  /**
   * 챌린지 HTML 페이지 생성
   * puzzleData가 제공되면 PoW 이후 퍼즐 CAPTCHA를 표시
   */
  getChallengeHtml(
    token: string,
    difficulty: number,
    puzzleData?: { id: string; gridImage: string; options: string[] },
  ): string {
    const hasPuzzle = !!puzzleData;
    const puzzleJson = hasPuzzle
      ? JSON.stringify(puzzleData).replace(/</g, '\\u003c')
      : 'null';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Security Check</title>
<style>
  body { background: #0a0e17; color: #e4e8f1; font-family: -apple-system, sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { text-align: center; max-width: 500px; }
  .spinner { width: 40px; height: 40px; border: 3px solid #2a3a4e; border-top-color: #00ff88;
             border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h2 { color: #00ff88; font-size: 1.2rem; }
  p { color: #8892a4; font-size: 0.9rem; }
  .puzzle-container { display: none; }
  .puzzle-grid { margin: 16px auto; }
  .puzzle-options { display: flex; gap: 12px; justify-content: center; margin: 16px 0; }
  .puzzle-option { cursor: pointer; border: 3px solid transparent; border-radius: 8px;
                   padding: 4px; transition: border-color 0.2s, transform 0.1s; background: #1a1a2e; }
  .puzzle-option:hover { border-color: #00ff88; transform: scale(1.05); }
  .puzzle-option.selected { border-color: #00ff88; }
  .timer { color: #f39c12; font-size: 1.5rem; font-weight: bold; margin: 8px 0; }
  .timer.urgent { color: #e74c3c; }
</style></head>
<body><div class="box">
  <div id="pow-section">
    <div class="spinner"></div>
    <h2>Checking your browser...</h2>
    <p>This will only take a moment.</p>
  </div>
  <div id="puzzle-section" class="puzzle-container">
    <h2>One more step</h2>
    <p>Type the characters you see below.</p>
    <div class="timer" id="timer">10</div>
    <div id="grid-container" class="puzzle-grid"></div>
    <div id="options-container" class="puzzle-options"></div>
  </div>
</div>
<script>
(async function() {
  var token = ${JSON.stringify(token).replace(/</g, '\\u003c')};
  var difficulty = ${Number(difficulty)};
  var puzzleData = ${puzzleJson};

  // 1. Browser fingerprint
  var fp = await generateFingerprint();

  // 2. Solve PoW
  var nonce = await solvePoW(token, difficulty);

  // 3. If puzzle required, show it; otherwise submit directly
  if (puzzleData) {
    showPuzzle(token, nonce, fp, puzzleData);
  } else {
    submitForm(token, nonce, fp, null, null);
  }

  function showPuzzle(token, nonce, fp, puzzle) {
    document.getElementById('pow-section').style.display = 'none';
    var puzzleSection = document.getElementById('puzzle-section');
    puzzleSection.style.display = 'block';

    // Render captcha image (safe DOM construction — no innerHTML)
    var gridContainer = document.getElementById('grid-container');
    var img = document.createElement('img');
    img.src = puzzle.gridImage;
    img.alt = 'captcha';
    img.style.cssText = 'border-radius:8px;';
    img.draggable = false;
    img.oncontextmenu = function() { return false; };
    gridContainer.appendChild(img);

    // Text input mode (no click options)
    var optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:center;margin-top:12px;';
    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 6;
    input.placeholder = 'Enter text...';
    input.autocomplete = 'off';
    input.style.cssText = 'width:160px;padding:10px 16px;background:#0d1520;border:2px solid #2a3a4e;border-radius:8px;color:#e4e8f1;font-family:monospace;font-size:1.1rem;text-align:center;letter-spacing:4px;';
    input.autofocus = true;
    var btn = document.createElement('button');
    btn.textContent = 'Verify';
    btn.style.cssText = 'padding:10px 20px;background:#00ff88;color:#0a0e17;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:0.9rem;';
    btn.onclick = function() {
      if (input.value.length > 0) submitForm(token, nonce, fp, puzzle.id, input.value);
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && input.value.length > 0) submitForm(token, nonce, fp, puzzle.id, input.value);
    };
    inputWrap.appendChild(input);
    inputWrap.appendChild(btn);
    optionsContainer.appendChild(inputWrap);
    var hint = document.createElement('p');
    hint.textContent = 'Case-insensitive';
    hint.style.cssText = 'color:#8892a4;font-size:0.7rem;margin-top:6px;';
    optionsContainer.appendChild(hint);
    setTimeout(function() { input.focus(); }, 100);

    // Countdown timer
    var remaining = 10;
    var timerEl = document.getElementById('timer');
    var interval = setInterval(function() {
      remaining--;
      timerEl.textContent = remaining;
      if (remaining <= 3) timerEl.className = 'timer urgent';
      if (remaining <= 0) {
        clearInterval(interval);
        timerEl.textContent = 'Time expired';
        setTimeout(function() { window.location.reload(); }, 500);
      }
    }, 1000);
  }

  function submitForm(token, nonce, fp, puzzleId, puzzleAnswer) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = '/challenge/verify';
    function addField(name, value) {
      if (value === null || value === undefined) return;
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
    if (puzzleId !== null) {
      addField('puzzleId', puzzleId);
      addField('puzzleAnswer', puzzleAnswer.toString());
    }
    document.body.appendChild(form);
    form.submit();
  }

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
    // 고정 길이 해시끼리 비교하므로 길이 불일치 시에도 constant-time 유지
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // 길이 다르면 dummy 비교로 타이밍 일정하게 유지
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
