import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Browser Fingerprinting Service
 * 브라우저의 고유한 특성을 수집하여 봇을 탐지
 */
@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);
  private readonly fingerprintCache = new Map<string, FingerprintData>();

  /**
   * 전체 브라우저 핑거프린트 생성
   */
  async generateFingerprint(data: BrowserData): Promise<BrowserFingerprint> {
    const fingerprintId = this.generateFingerprintId(data);

    // 캐시 확인
    const cached = this.fingerprintCache.get(fingerprintId);
    if (cached && this.isCacheValid(cached)) {
      return cached.fingerprint;
    }

    const fingerprint: BrowserFingerprint = {
      id: fingerprintId,
      canvas: data.canvas || 'unavailable',
      webgl: data.webgl,
      audio: data.audio || 'unavailable',
      fonts: data.fonts || [],
      screen: this.processScreenData(data.screen),
      timezone: data.timezone,
      language: data.language,
      platform: data.platform,
      hardwareConcurrency: data.hardwareConcurrency,
      deviceMemory: data.deviceMemory,
      colorDepth: data.colorDepth,
      pixelRatio: data.pixelRatio,
      touchSupport: data.touchSupport,
      webrtc: data.webrtc,
      plugins: this.processPlugins(data.plugins),
      timestamp: new Date(),
      trustScore: this.calculateTrustScore(data),
    };

    // 캐시 저장
    this.fingerprintCache.set(fingerprintId, {
      fingerprint,
      createdAt: Date.now(),
    });

    this.logger.debug(`Generated fingerprint: ${fingerprintId}`);
    return fingerprint;
  }

  /**
   * Canvas 핑거프린트 검증
   */
  validateCanvasFingerprint(canvas: string): CanvasValidation {
    // 알려진 봇 Canvas 시그니처
    const knownBotSignatures = [
      'd3d3d3d3d3d3', // Headless Chrome default
      '000000000000', // Puppeteer default
      'fffffffffffff', // PhantomJS
    ];

    if (knownBotSignatures.includes(canvas)) {
      return {
        isValid: false,
        isBot: true,
        reason: 'Known bot canvas signature',
        confidence: 0.95,
      };
    }

    // Canvas가 너무 단순한 경우
    if (this.isCanvasTooSimple(canvas)) {
      return {
        isValid: false,
        isBot: true,
        reason: 'Canvas too simple',
        confidence: 0.8,
      };
    }

    // 엔트로피 계산
    const entropy = this.calculateEntropy(canvas);
    if (entropy < 2.0) {
      return {
        isValid: false,
        isBot: true,
        reason: 'Low canvas entropy',
        confidence: 0.7,
      };
    }

    return {
      isValid: true,
      isBot: false,
      confidence: 0.1,
    };
  }

  /**
   * WebGL 핑거프린트 검증
   */
  validateWebGLFingerprint(webgl: WebGLData): WebGLValidation {
    // WebGL이 없는 경우
    if (!webgl || !webgl.renderer) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'WebGL not available',
        confidence: 0.6,
      };
    }

    // 알려진 가상 그래픽 드라이버
    const virtualDrivers = [
      'Mesa DRI Intel',
      'Google SwiftShader',
      'VMware',
      'VirtualBox',
    ];

    const renderer = webgl.renderer?.toLowerCase() || '';
    const vendor = webgl.vendor?.toLowerCase() || '';

    for (const driver of virtualDrivers) {
      if (renderer.includes(driver.toLowerCase()) ||
          vendor.includes(driver.toLowerCase())) {
        return {
          isValid: false,
          suspicious: true,
          reason: `Virtual graphics driver detected: ${driver}`,
          confidence: 0.85,
        };
      }
    }

    // 렌더러와 벤더 불일치 체크
    if (this.isRendererVendorMismatch(renderer, vendor)) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Renderer/Vendor mismatch',
        confidence: 0.75,
      };
    }

    return {
      isValid: true,
      suspicious: false,
      confidence: 0.1,
    };
  }

  /**
   * Audio 핑거프린트 검증
   */
  validateAudioFingerprint(audio: string): AudioValidation {
    // Audio context가 없는 경우
    if (!audio || audio === 'unavailable') {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Audio context not available',
        confidence: 0.5,
      };
    }

    // 알려진 봇 오디오 시그니처
    const botAudioSignatures = [
      '0.0000000000', // 완전한 무음
      '1.1111111111', // 일정한 패턴
    ];

    if (botAudioSignatures.includes(audio)) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Known bot audio signature',
        confidence: 0.9,
      };
    }

    // 오디오 복잡도 분석
    const complexity = this.calculateAudioComplexity(audio);
    if (complexity < 0.1) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Audio too simple',
        confidence: 0.7,
      };
    }

    return {
      isValid: true,
      suspicious: false,
      confidence: 0.1,
    };
  }

  /**
   * 폰트 리스트 검증
   */
  validateFonts(fonts: string[]): FontValidation {
    // 폰트가 너무 적은 경우
    if (fonts.length < 10) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Too few fonts',
        confidence: 0.6,
      };
    }

    // Headless 브라우저 기본 폰트 체크
    const headlessFonts = ['Ahem', 'TestFont'];
    const hasHeadlessFont = fonts.some(font =>
      headlessFonts.includes(font)
    );

    if (hasHeadlessFont) {
      return {
        isValid: false,
        suspicious: true,
        reason: 'Headless browser font detected',
        confidence: 0.9,
      };
    }

    return {
      isValid: true,
      suspicious: false,
      confidence: 0.1,
    };
  }

  /**
   * 종합적인 봇 탐지 점수 계산
   */
  calculateBotScore(fingerprint: BrowserFingerprint): BotDetectionResult {
    let score = 0;
    const factors: string[] = [];

    // Canvas 검증
    const canvasValidation = this.validateCanvasFingerprint(fingerprint.canvas);
    if (canvasValidation.isBot) {
      score += 25;
      factors.push(`Canvas: ${canvasValidation.reason}`);
    }

    // WebGL 검증
    if (fingerprint.webgl) {
      const webglValidation = this.validateWebGLFingerprint(fingerprint.webgl);
      if (webglValidation.suspicious) {
        score += 20;
        factors.push(`WebGL: ${webglValidation.reason}`);
      }
    }

    // Audio 검증
    const audioValidation = this.validateAudioFingerprint(fingerprint.audio);
    if (audioValidation.suspicious) {
      score += 15;
      factors.push(`Audio: ${audioValidation.reason}`);
    }

    // 폰트 검증
    const fontValidation = this.validateFonts(fingerprint.fonts);
    if (fontValidation.suspicious) {
      score += 10;
      factors.push(`Fonts: ${fontValidation.reason}`);
    }

    // 하드웨어 특성 검증
    if (fingerprint.hardwareConcurrency === 1) {
      score += 10;
      factors.push('Single core detected');
    }

    if (!fingerprint.touchSupport && fingerprint.platform === 'mobile') {
      score += 15;
      factors.push('Mobile without touch support');
    }

    // WebRTC 누출 체크
    if (fingerprint.webrtc?.leaked) {
      score += 5;
      factors.push('WebRTC IP leak detected');
    }

    return {
      score: Math.min(100, score),
      isBot: score >= 50,
      confidence: score / 100,
      factors,
      recommendation: this.getRecommendation(score),
    };
  }

  // ===== Private Helper Methods =====

  private generateFingerprintId(data: BrowserData): string {
    const components = [
      data.canvas,
      data.webgl?.renderer,
      data.webgl?.vendor,
      data.audio,
      data.screen?.width,
      data.screen?.height,
      data.timezone,
      data.language,
      data.platform,
    ].filter(Boolean).join('|');

    return crypto
      .createHash('sha256')
      .update(components)
      .digest('hex')
      .substring(0, 16);
  }

  private processScreenData(screen: any): ScreenData {
    return {
      width: screen?.width || 0,
      height: screen?.height || 0,
      availWidth: screen?.availWidth || 0,
      availHeight: screen?.availHeight || 0,
      colorDepth: screen?.colorDepth || 0,
      pixelDepth: screen?.pixelDepth || 0,
    };
  }

  private processPlugins(plugins: any[]): string[] {
    if (!plugins || !Array.isArray(plugins)) return [];

    return plugins
      .map(p => p.name || p)
      .filter(Boolean)
      .slice(0, 50); // 최대 50개만
  }

  private calculateTrustScore(data: BrowserData): number {
    let score = 100;

    // 필수 요소가 없으면 감점
    if (!data.canvas) score -= 20;
    if (!data.webgl) score -= 15;
    if (!data.audio) score -= 10;
    if (!data.fonts || data.fonts.length === 0) score -= 10;
    if (!data.screen) score -= 5;

    // 의심스러운 패턴
    if (data.hardwareConcurrency === 1) score -= 10;
    if (data.deviceMemory && data.deviceMemory < 2) score -= 5;
    if (data.plugins && data.plugins.length === 0) score -= 5;

    return Math.max(0, score);
  }

  private isCanvasTooSimple(canvas: string): boolean {
    // 같은 문자의 반복인지 체크
    const uniqueChars = new Set(canvas).size;
    return uniqueChars < 5;
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: { [key: string]: number } = {};

    for (const char of str) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const freq of Object.values(frequencies)) {
      const p = freq / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private isRendererVendorMismatch(renderer: string, vendor: string): boolean {
    const knownPairs = [
      { vendor: 'nvidia', renderer: 'geforce' },
      { vendor: 'amd', renderer: 'radeon' },
      { vendor: 'intel', renderer: 'intel' },
      { vendor: 'apple', renderer: 'apple' },
    ];

    for (const pair of knownPairs) {
      if (vendor.includes(pair.vendor) && !renderer.includes(pair.renderer)) {
        return true;
      }
    }

    return false;
  }

  private calculateAudioComplexity(audio: string): number {
    // 오디오 시그니처의 복잡도 계산
    const values = audio.split('').map(c => c.charCodeAt(0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private isCacheValid(cached: FingerprintData): boolean {
    const MAX_AGE = 3600000; // 1시간
    return Date.now() - cached.createdAt < MAX_AGE;
  }

  private getRecommendation(score: number): string {
    if (score >= 80) return 'BLOCK';
    if (score >= 60) return 'CHALLENGE';
    if (score >= 40) return 'MONITOR';
    if (score >= 20) return 'LOG';
    return 'ALLOW';
  }
}

// ===== Type Definitions =====

export interface BrowserData {
  canvas?: string;
  webgl?: WebGLData;
  audio?: string;
  fonts?: string[];
  screen?: any;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  colorDepth?: number;
  pixelRatio?: number;
  touchSupport?: boolean;
  webrtc?: WebRTCData;
  plugins?: any[];
}

export interface WebGLData {
  renderer?: string;
  vendor?: string;
  version?: string;
  shadingLanguageVersion?: string;
  extensions?: string[];
}

export interface WebRTCData {
  localIP?: string;
  publicIP?: string;
  leaked?: boolean;
}

export interface ScreenData {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
}

export interface BrowserFingerprint {
  id: string;
  canvas: string;
  webgl: WebGLData;
  audio: string;
  fonts: string[];
  screen: ScreenData;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  colorDepth?: number;
  pixelRatio?: number;
  touchSupport?: boolean;
  webrtc?: WebRTCData;
  plugins?: string[];
  timestamp: Date;
  trustScore: number;
}

export interface FingerprintData {
  fingerprint: BrowserFingerprint;
  createdAt: number;
}

export interface CanvasValidation {
  isValid: boolean;
  isBot: boolean;
  reason?: string;
  confidence: number;
}

export interface WebGLValidation {
  isValid: boolean;
  suspicious: boolean;
  reason?: string;
  confidence: number;
}

export interface AudioValidation {
  isValid: boolean;
  suspicious: boolean;
  reason?: string;
  confidence: number;
}

export interface FontValidation {
  isValid: boolean;
  suspicious: boolean;
  reason?: string;
  confidence: number;
}

export interface BotDetectionResult {
  score: number;
  isBot: boolean;
  confidence: number;
  factors: string[];
  recommendation: string;
}
