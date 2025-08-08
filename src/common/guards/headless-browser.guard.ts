import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { IpBlacklistService } from '../services/ip-blacklist.service';

/**
 * Headless Browser 탐지 Guard
 *
 * 탐지 방법:
 * 1. User-Agent 패턴 분석
 * 2. 헤더 일관성 검사
 * 3. JavaScript 실행 검증
 * 4. 브라우저 특성 검사
 *
 * 장점:
 * - Puppeteer, Playwright 등 자동화 도구 차단
 * - 정교한 스크래핑 방지
 *
 * 단점:
 * - 완벽한 탐지는 불가능
 * - 정상적인 헤드리스 사용 (CI/CD, 테스팅) 차단 가능
 * - 클라이언트 사이드 검증 필요
 */
@Injectable()
export class HeadlessBrowserGuard implements CanActivate {
  private readonly logger = new Logger(HeadlessBrowserGuard.name);

  // Headless 브라우저 시그니처
  private readonly headlessSignatures = {
    userAgent: ['HeadlessChrome', 'Headless', 'PhantomJS', 'Nightmare', 'Electron', 'Zombie'],

    // Headless 브라우저가 자주 누락하는 헤더
    requiredHeaders: ['accept-language', 'accept-encoding', 'accept'],

    // 의심스러운 헤더 값
    suspiciousHeaders: {
      'accept-language': [
        'en-US', // 너무 기본적인 값
        '*', // 모든 언어
      ],
      'accept-encoding': [
        '*', // 모든 인코딩
      ],
    },
  };

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.extractIp(request);
    const headers = request.headers;
    const userAgent = headers['user-agent'] || '';

    // 1. User-Agent에서 Headless 시그니처 확인
    if (this.hasHeadlessUserAgentSignature(userAgent)) {
      await this.handleHeadlessDetection(ip, 'user_agent_signature', userAgent);
      throw new ForbiddenException('Automated browser detected');
    }

    // 2. Chrome 헤드리스 특정 패턴 확인
    if (this.isChromeHeadless(headers)) {
      await this.handleHeadlessDetection(ip, 'chrome_headless_pattern', userAgent);
      throw new ForbiddenException('Automated browser detected');
    }

    // 3. 필수 헤더 존재 여부 확인
    const missingHeaders = this.checkRequiredHeaders(headers);
    if (missingHeaders.length > 0) {
      this.logger.warn(
        `[HEADLESS] Missing headers detected from IP ${ip}: ${missingHeaders.join(', ')}`,
      );
      // 너무 엄격할 수 있으므로 경고만
      // throw new ForbiddenException('Invalid browser headers');
    }

    // 4. 헤더 일관성 검사
    if (!this.areHeadersConsistent(headers)) {
      this.logger.warn(`[HEADLESS] Inconsistent headers from IP ${ip}`);
      // 의심스러운 활동으로 기록
      await this.recordSuspiciousActivity(ip, 'inconsistent_headers');
    }

    // 5. WebDriver 속성 확인 (클라이언트에서 전송된 경우)
    if (this.hasWebDriverProperty(request)) {
      await this.handleHeadlessDetection(ip, 'webdriver_property', userAgent);
      throw new ForbiddenException('Automated browser detected');
    }

    // 6. 브라우저 핑거프린트 검증 (클라이언트에서 전송된 경우)
    if (!this.isValidFingerprint(request)) {
      this.logger.warn(`[HEADLESS] Invalid browser fingerprint from IP ${ip}`);
      // 추가 검증 필요
    }

    return true;
  }

  /**
   * User-Agent에서 Headless 시그니처 확인
   */
  private hasHeadlessUserAgentSignature(userAgent: string): boolean {
    const lowerUA = userAgent.toLowerCase();

    return this.headlessSignatures.userAgent.some((signature) =>
      lowerUA.includes(signature.toLowerCase()),
    );
  }

  /**
   * Chrome Headless 특정 패턴 확인
   */
  private isChromeHeadless(headers: any): boolean {
    const userAgent = headers['user-agent'] || '';

    // Chrome 헤드리스의 특징적인 패턴들
    const patterns = [
      // Chrome 헤드리스는 종종 특정 버전 패턴을 가짐
      /Chrome\/\d+\.0\.0\.0/,
      // 헤드리스 모드 명시
      /HeadlessChrome/i,
    ];

    if (patterns.some((pattern) => pattern.test(userAgent))) {
      return true;
    }

    // Chrome이지만 일부 헤더가 누락된 경우
    if (userAgent.includes('Chrome')) {
      // 정상 Chrome은 보통 이 헤더들을 모두 포함
      const chromeHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];

      const hasSecHeaders = chromeHeaders.some((header) => headers[header]);

      // Chrome이라고 하면서 Sec-CH-UA 헤더가 없으면 의심
      if (!hasSecHeaders && !this.isOldChrome(userAgent)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 오래된 Chrome 버전인지 확인
   */
  private isOldChrome(userAgent: string): boolean {
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      const version = parseInt(match[1], 10);
      return version < 90; // Chrome 90 이전 버전
    }
    return false;
  }

  /**
   * 필수 헤더 확인
   */
  private checkRequiredHeaders(headers: any): string[] {
    const missing: string[] = [];

    for (const header of this.headlessSignatures.requiredHeaders) {
      if (!headers[header]) {
        missing.push(header);
      }
    }

    return missing;
  }

  /**
   * 헤더 일관성 검사
   */
  private areHeadersConsistent(headers: any): boolean {
    const userAgent = headers['user-agent'] || '';

    // 1. User-Agent와 Accept 헤더 일관성
    if (userAgent.includes('Mozilla') && !headers['accept']) {
      return false; // Mozilla 브라우저는 항상 Accept 헤더를 보냄
    }

    // 2. 모바일 User-Agent와 화면 크기 일관성
    if (userAgent.includes('Mobile') && headers['sec-ch-ua-mobile'] === '?0') {
      return false; // 모바일 UA인데 데스크톱으로 표시
    }

    // 3. Accept-Language 검증
    const acceptLang = headers['accept-language'];
    if (acceptLang && this.isSuspiciousLanguage(acceptLang)) {
      return false;
    }

    // 4. 연결 헤더 검증
    const connection = headers['connection'];
    if (connection && connection !== 'keep-alive' && connection !== 'close') {
      return false; // 비정상적인 connection 값
    }

    return true;
  }

  /**
   * 의심스러운 언어 설정 확인
   */
  private isSuspiciousLanguage(acceptLanguage: string): boolean {
    // 너무 단순하거나 비정상적인 패턴
    const suspiciousPatterns = [
      /^\*$/, // 모든 언어
      /^en$/, // 너무 단순
      /^en-US$/, // 가중치 없는 단일 언어
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(acceptLanguage));
  }

  /**
   * WebDriver 속성 확인
   */
  private hasWebDriverProperty(request: any): boolean {
    // 클라이언트에서 navigator.webdriver 값을 전송한 경우
    const body = request.body || {};
    const query = request.query || {};

    // 명시적으로 webdriver 속성이 true로 설정된 경우
    if (body._webdriver === true || query._webdriver === 'true') {
      return true;
    }

    // 브라우저 속성 검사 (클라이언트에서 전송한 경우)
    if (body._browserProps) {
      const props = body._browserProps;
      if (
        props.webdriver === true ||
        props.automation === true ||
        props.phantom === true ||
        props._Selenium_IDE_Recorder !== undefined ||
        props._selenium !== undefined ||
        props.callPhantom !== undefined
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 브라우저 핑거프린트 검증
   */
  private isValidFingerprint(request: any): boolean {
    const fingerprint = request.body?._fingerprint || request.headers['x-browser-fingerprint'];

    if (!fingerprint) {
      return true; // 핑거프린트가 없으면 통과 (선택적 검증)
    }

    try {
      const fp = typeof fingerprint === 'string' ? JSON.parse(fingerprint) : fingerprint;

      // 1. 화면 해상도 검증
      if (fp.screen) {
        const { width, height } = fp.screen;
        // 0x0이거나 비정상적인 해상도
        if (width === 0 || height === 0 || width === height) {
          return false;
        }
      }

      // 2. 플러그인 검증
      if (fp.plugins !== undefined) {
        // Headless는 보통 플러그인이 없음
        if (Array.isArray(fp.plugins) && fp.plugins.length === 0) {
          this.logger.debug('No plugins detected - possible headless');
        }
      }

      // 3. Canvas 핑거프린트 검증
      if (fp.canvas === 'blocked' || fp.canvas === 'not available') {
        return false; // Canvas API가 차단됨
      }

      // 4. WebGL 검증
      if (fp.webgl && fp.webgl.vendor === 'Brian Paul' && fp.webgl.renderer === 'Mesa OffScreen') {
        return false; // 가상 그래픽 드라이버 (헤드리스 특징)
      }

      // 5. 언어 일관성
      if (fp.languages && fp.languages.length === 0) {
        return false; // 언어 설정이 없음
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to parse fingerprint:', error);
      return true; // 파싱 실패 시 통과
    }
  }

  /**
   * Headless 브라우저 탐지 시 처리
   */
  private async handleHeadlessDetection(
    ip: string,
    detectionMethod: string,
    userAgent: string,
  ): Promise<void> {
    this.logger.warn(
      `[HEADLESS] Detected! IP: ${ip}, Method: ${detectionMethod}, UA: ${userAgent}`,
    );

    // IP를 블랙리스트에 추가 (6시간)
    await this.ipBlacklistService.blacklistIp(ip, `headless_${detectionMethod}`, 21600);
  }

  /**
   * 의심스러운 활동 기록
   */
  private async recordSuspiciousActivity(ip: string, reason: string): Promise<void> {
    // Redis나 데이터베이스에 기록
    // 일정 횟수 이상 의심스러운 활동이 감지되면 자동 차단
    this.logger.debug(`[HEADLESS] Suspicious activity from IP ${ip}: ${reason}`);
  }

  /**
   * IP 추출
   */
  private extractIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return ips[0];
    }

    return (
      request.headers['x-real-ip'] ||
      request.headers['x-client-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      ''
    );
  }
}

/**
 * 클라이언트 사이드 Headless 탐지 스크립트
 */
export class HeadlessDetectionScript {
  /**
   * 브라우저 탐지 스크립트 생성
   */
  static generateDetectionScript(): string {
    return `
      <script>
        (function() {
          // Headless 브라우저 탐지 함수
          function detectHeadlessBrowser() {
            const detectionResults = {
              webdriver: false,
              headless: false,
              automation: false,
              fingerprint: {}
            };
            
            // 1. WebDriver 탐지
            if (navigator.webdriver === true) {
              detectionResults.webdriver = true;
            }
            
            // 2. Chrome Headless 탐지
            if (navigator.userAgent.includes('HeadlessChrome')) {
              detectionResults.headless = true;
            }
            
            // 3. Permissions API 탐지 (Headless는 다르게 동작)
            if (navigator.permissions) {
              navigator.permissions.query({ name: 'notifications' })
                .then(function(permissionStatus) {
                  if (permissionStatus.state === 'prompt' && navigator.webdriver) {
                    detectionResults.headless = true;
                  }
                });
            }
            
            // 4. 플러그인 탐지
            detectionResults.fingerprint.plugins = [];
            if (navigator.plugins) {
              for (let i = 0; i < navigator.plugins.length; i++) {
                detectionResults.fingerprint.plugins.push(navigator.plugins[i].name);
              }
            }
            
            // 5. 화면 크기 탐지
            detectionResults.fingerprint.screen = {
              width: window.screen.width,
              height: window.screen.height,
              availWidth: window.screen.availWidth,
              availHeight: window.screen.availHeight,
              colorDepth: window.screen.colorDepth,
              pixelDepth: window.screen.pixelDepth
            };
            
            // 6. Canvas 핑거프린팅
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              ctx.textBaseline = 'top';
              ctx.font = '14px "Arial"';
              ctx.fillText('fingerprint', 2, 2);
              detectionResults.fingerprint.canvas = canvas.toDataURL();
            } catch (e) {
              detectionResults.fingerprint.canvas = 'blocked';
            }
            
            // 7. WebGL 정보
            try {
              const canvas = document.createElement('canvas');
              const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
              if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                  detectionResults.fingerprint.webgl = {
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                  };
                }
              }
            } catch (e) {
              detectionResults.fingerprint.webgl = 'blocked';
            }
            
            // 8. 언어 설정
            detectionResults.fingerprint.languages = navigator.languages || [];
            
            // 9. 자동화 도구 탐지
            const automationProps = [
              '_phantom',
              '__nightmare',
              '_selenium',
              'callPhantom',
              'callSelenium',
              '_Selenium_IDE_Recorder'
            ];
            
            for (const prop of automationProps) {
              if (window[prop] !== undefined) {
                detectionResults.automation = true;
                break;
              }
            }
            
            // 10. Chrome 특정 탐지
            if (window.chrome) {
              detectionResults.fingerprint.chrome = {
                runtime: !!window.chrome.runtime,
                loadTimes: typeof window.chrome.loadTimes === 'function'
              };
            }
            
            return detectionResults;
          }
          
          // 탐지 결과를 서버로 전송
          function sendDetectionResults() {
            const results = detectHeadlessBrowser();
            
            // 모든 폼에 탐지 결과 추가
            document.addEventListener('submit', function(e) {
              if (e.target.tagName === 'FORM') {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = '_browserProps';
                input.value = JSON.stringify(results);
                e.target.appendChild(input);
                
                // WebDriver 탐지된 경우 추가 플래그
                if (results.webdriver) {
                  const wdInput = document.createElement('input');
                  wdInput.type = 'hidden';
                  wdInput.name = '_webdriver';
                  wdInput.value = 'true';
                  e.target.appendChild(wdInput);
                }
              }
            });
            
            // AJAX 요청에 헤더로 추가
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              if (args[1] && typeof args[1] === 'object') {
                args[1].headers = args[1].headers || {};
                args[1].headers['X-Browser-Fingerprint'] = JSON.stringify(results.fingerprint);
                
                if (results.webdriver || results.headless || results.automation) {
                  args[1].headers['X-Automated-Browser'] = 'true';
                }
              }
              return originalFetch.apply(this, args);
            };
          }
          
          // 페이지 로드 시 실행
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', sendDetectionResults);
          } else {
            sendDetectionResults();
          }
        })();
      </script>
    `;
  }
}
