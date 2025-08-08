import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { HttpService } from '../services/http.service';
import { IpBlacklistService } from '../services/ip-blacklist.service';

/**
 * Google reCAPTCHA v3 Guard
 *
 * 작동 원리:
 * 1. 클라이언트가 Google reCAPTCHA v3 토큰을 생성
 * 2. 요청과 함께 토큰을 서버로 전송
 * 3. 서버가 Google API로 토큰 검증
 * 4. 점수가 임계값 이하면 봇으로 판단
 *
 * 장점:
 * - 사용자 상호작용 불필요 (v3)
 * - Google의 머신러닝 기반 봇 탐지
 * - 높은 정확도
 *
 * 단점:
 * - Google 서비스 의존성
 * - 네트워크 레이턴시 추가
 * - 개인정보 보호 우려 (Google에 데이터 전송)
 * - 유료 (무료 한도 초과 시)
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  private readonly logger = new Logger(RecaptchaGuard.name);
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
  private readonly secretKey: string;
  private readonly scoreThreshold: number;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private ipBlacklistService: IpBlacklistService,
  ) {
    this.secretKey = this.configService.get<string>('app.recaptcha.secretKey', '');
    this.scoreThreshold = this.configService.get<number>('app.recaptcha.scoreThreshold', 0.5);

    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured. Guard will be bypassed.');
    } else {
      this.logger.log(`RecaptchaGuard initialized with score threshold: ${this.scoreThreshold}`);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Secret key가 설정되지 않으면 검증 스킵 (개발 환경용)
    if (!this.secretKey) {
      this.logger.debug('reCAPTCHA validation skipped (no secret key)');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = this.extractIp(request);

    // GET 요청은 reCAPTCHA 검사 스킵 (선택적)
    if (request.method === 'GET') {
      return true;
    }

    // 토큰 추출 (헤더 또는 바디에서)
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn(`[RECAPTCHA] Missing token from IP: ${ip}`);
      throw new HttpException('reCAPTCHA token required', HttpStatus.PRECONDITION_FAILED);
    }

    try {
      // Google reCAPTCHA API로 토큰 검증
      const verificationResult = await this.verifyToken(token, ip);

      if (!verificationResult.success) {
        this.logger.warn(
          `[RECAPTCHA] Verification failed for IP: ${ip}, ` +
            `Errors: ${verificationResult.errorCodes?.join(', ') || 'unknown'}`,
        );

        // 특정 에러 코드에 따른 처리
        if (verificationResult.errorCodes?.includes('timeout-or-duplicate')) {
          throw new HttpException(
            'reCAPTCHA token expired or already used',
            HttpStatus.BAD_REQUEST,
          );
        }

        throw new ForbiddenException('reCAPTCHA verification failed');
      }

      // 점수 확인 (v3)
      if (verificationResult.score !== undefined) {
        this.logger.debug(
          `[RECAPTCHA] Score for IP ${ip}: ${verificationResult.score}, ` +
            `Action: ${verificationResult.action || 'unknown'}`,
        );

        if (verificationResult.score < this.scoreThreshold) {
          this.logger.warn(
            `[RECAPTCHA] Low score detected! IP: ${ip}, Score: ${verificationResult.score}`,
          );

          // 낮은 점수의 IP를 블랙리스트에 추가 (선택적)
          if (verificationResult.score < 0.3) {
            await this.ipBlacklistService.blacklistIp(
              ip,
              `recaptcha_low_score_${verificationResult.score}`,
              7200, // 2시간
            );
          }

          throw new ForbiddenException('Request appears to be automated');
        }
      }

      // 호스트명 확인 (선택적)
      if (verificationResult.hostname && !this.isValidHostname(verificationResult.hostname)) {
        this.logger.warn(
          `[RECAPTCHA] Invalid hostname: ${verificationResult.hostname} from IP: ${ip}`,
        );
        throw new ForbiddenException('Invalid request origin');
      }

      // 액션 확인 (선택적)
      if (verificationResult.action && !this.isValidAction(request, verificationResult.action)) {
        this.logger.warn(
          `[RECAPTCHA] Action mismatch. Expected: ${this.getExpectedAction(request)}, ` +
            `Got: ${verificationResult.action} from IP: ${ip}`,
        );
        throw new ForbiddenException('Invalid request action');
      }

      // 검증 성공
      this.logger.debug(`[RECAPTCHA] Verification successful for IP: ${ip}`);

      // 요청에 reCAPTCHA 결과 첨부 (다른 가드에서 사용 가능)
      request.recaptchaResult = verificationResult;

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`[RECAPTCHA] Verification error for IP ${ip}:`, error);

      // 네트워크 오류 등의 경우 요청을 차단할지 통과시킬지 결정
      const failOpen = this.configService.get<boolean>('app.recaptcha.failOpen', false);

      if (failOpen) {
        this.logger.warn('[RECAPTCHA] Failing open due to verification error');
        return true;
      } else {
        throw new HttpException(
          'reCAPTCHA verification service unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
  }

  /**
   * 요청에서 reCAPTCHA 토큰 추출
   */
  private extractToken(request: any): string | null {
    // 1. Authorization 헤더에서 확인 (Bearer 토큰 형식)
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Recaptcha ')) {
      return authHeader.substring(10);
    }

    // 2. 커스텀 헤더에서 확인
    const customHeader = request.headers['x-recaptcha-token'];
    if (customHeader) {
      return customHeader;
    }

    // 3. 요청 바디에서 확인
    const body = request.body || {};
    if (body.recaptchaToken) {
      return body.recaptchaToken;
    }

    if (body.g_recaptcha_response) {
      return body.g_recaptcha_response;
    }

    // 4. 쿼리 파라미터에서 확인 (GET 요청용)
    if (request.query?.recaptchaToken) {
      return request.query.recaptchaToken;
    }

    return null;
  }

  /**
   * Google reCAPTCHA API로 토큰 검증
   */
  private async verifyToken(
    token: string,
    remoteIp?: string,
  ): Promise<RecaptchaVerificationResult> {
    try {
      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);

      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await this.httpService.post<GoogleRecaptchaResponse>(
        this.verifyUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        },
      );

      return {
        success: response.data.success,
        score: response.data.score,
        action: response.data.action,
        hostname: response.data.hostname,
        challengeTimestamp: response.data.challenge_ts,
        errorCodes: response.data['error-codes'],
      };
    } catch (error) {
      this.logger.error('Failed to verify reCAPTCHA token:', error);
      throw error;
    }
  }

  /**
   * 호스트명 검증
   */
  private isValidHostname(hostname: string): boolean {
    const allowedHostnames = this.configService.get<string[]>('app.recaptcha.allowedHostnames', []);

    // 설정이 없으면 모든 호스트명 허용
    if (allowedHostnames.length === 0) {
      return true;
    }

    return allowedHostnames.includes(hostname);
  }

  /**
   * 액션 검증
   */
  private isValidAction(request: any, action: string): boolean {
    const expectedAction = this.getExpectedAction(request);

    // 예상 액션이 없으면 모든 액션 허용
    if (!expectedAction) {
      return true;
    }

    return action === expectedAction;
  }

  /**
   * 요청 경로에 따른 예상 액션 반환
   */
  private getExpectedAction(request: any): string | null {
    const path = request.path;

    // 경로별 액션 매핑
    const actionMap = {
      '/api/login': 'login',
      '/api/register': 'register',
      '/api/contact': 'contact',
      '/api/comment': 'comment',
      '/api/data': 'data_access',
    };

    for (const [pathPrefix, action] of Object.entries(actionMap)) {
      if (path.startsWith(pathPrefix)) {
        return action;
      }
    }

    return null;
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

    const realIp =
      request.headers['x-real-ip'] ||
      request.headers['x-client-ip'] ||
      request.ip ||
      request.connection?.remoteAddress;

    if (realIp && realIp.includes('::ffff:')) {
      return realIp.replace('::ffff:', '');
    }

    return realIp;
  }
}

/**
 * reCAPTCHA 검증 결과 인터페이스
 */
interface RecaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challengeTimestamp?: string;
  errorCodes?: string[];
}

/**
 * Google reCAPTCHA API 응답 인터페이스
 */
interface GoogleRecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * reCAPTCHA 클라이언트 헬퍼
 * 프론트엔드에서 사용할 스크립트 생성
 */
export class RecaptchaClientHelper {
  /**
   * reCAPTCHA v3 스크립트 태그 생성
   */
  static generateScriptTag(siteKey: string): string {
    return `<script src="https://www.google.com/recaptcha/api.js?render=${siteKey}"></script>`;
  }

  /**
   * reCAPTCHA v3 토큰 생성 JavaScript 코드
   */
  static generateTokenScript(siteKey: string, action: string = 'submit'): string {
    return `
      <script>
        function getRecaptchaToken(action = '${action}') {
          return new Promise((resolve, reject) => {
            grecaptcha.ready(function() {
              grecaptcha.execute('${siteKey}', {action: action})
                .then(function(token) {
                  resolve(token);
                })
                .catch(function(error) {
                  reject(error);
                });
            });
          });
        }
        
        // 폼 제출 시 자동으로 토큰 추가
        document.addEventListener('DOMContentLoaded', function() {
          const forms = document.querySelectorAll('form[data-recaptcha]');
          
          forms.forEach(function(form) {
            form.addEventListener('submit', async function(e) {
              e.preventDefault();
              
              try {
                // 토큰 생성
                const action = form.dataset.recaptchaAction || 'submit';
                const token = await getRecaptchaToken(action);
                
                // 토큰을 폼에 추가
                let tokenInput = form.querySelector('input[name="recaptchaToken"]');
                if (!tokenInput) {
                  tokenInput = document.createElement('input');
                  tokenInput.type = 'hidden';
                  tokenInput.name = 'recaptchaToken';
                  form.appendChild(tokenInput);
                }
                tokenInput.value = token;
                
                // 폼 제출
                form.submit();
              } catch (error) {
                console.error('reCAPTCHA error:', error);
                alert('Please verify that you are not a robot.');
              }
            });
          });
        });
        
        // AJAX 요청에 토큰 추가하는 헬퍼 함수
        async function fetchWithRecaptcha(url, options = {}, action = 'api') {
          const token = await getRecaptchaToken(action);
          
          const headers = options.headers || {};
          headers['X-Recaptcha-Token'] = token;
          
          return fetch(url, {
            ...options,
            headers
          });
        }
      </script>
    `;
  }

  /**
   * reCAPTCHA v2 체크박스 HTML 생성
   */
  static generateV2Checkbox(siteKey: string): string {
    return `
      <div class="g-recaptcha" data-sitekey="${siteKey}"></div>
      <script src="https://www.google.com/recaptcha/api.js" async defer></script>
    `;
  }
}
