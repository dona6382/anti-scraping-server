import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { ConfigurationService } from '../../modules/configuration/configuration.service';
import { HttpService } from '../services/http.service';
import { ExtendedRequest } from '../../types';

/**
 * reCAPTCHA v3 Guard
 * Google reCAPTCHA v3를 사용하여 봇을 탐지
 */
@Injectable()
export class RecaptchaGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(RecaptchaGuard.name);
  
  private readonly secretKey: string;
  private readonly scoreThreshold: number;
  private readonly failOpen: boolean;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly configService: ConfigurationService,
    private readonly httpService: HttpService,
  ) {
    super();
    
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY', '');
    this.scoreThreshold = this.configService.get<number>('RECAPTCHA_SCORE_THRESHOLD', 0.5);
    this.failOpen = this.configService.get<boolean>('RECAPTCHA_FAIL_OPEN', true);
    
    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured - guard will be bypassed');
    } else {
      this.logger.log(
        `Initialized with score threshold: ${this.scoreThreshold}, fail-open: ${this.failOpen}`,
      );
    }
  }

  /**
   * canActivate 메서드 구현
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    return this.validateRequest(request);
  }

  protected getGuardName(): string {
    return 'RecaptchaGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    // reCAPTCHA가 설정되지 않은 경우
    if (!this.secretKey) {
      return this.failOpen;
    }

    // POST, PUT, PATCH 요청에만 적용
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      this.logger.warn(`Missing reCAPTCHA token from ${this.getClientIp(request)}`);
      return this.failOpen;
    }

    try {
      const verification = await this.verifyToken(token, request);
      
      if (!verification.success) {
        this.logger.warn(
          `reCAPTCHA verification failed from ${this.getClientIp(request)}: ${JSON.stringify(verification['error-codes'])}`,
        );
        return false;
      }

      if (verification.score < this.scoreThreshold) {
        this.logger.warn(
          `reCAPTCHA score too low: ${verification.score} from ${this.getClientIp(request)}`,
        );
        return false;
      }

      // 호스트명 검증 (선택적)
      if (verification.hostname && !this.isValidHostname(verification.hostname)) {
        this.logger.warn(
          `Invalid hostname in reCAPTCHA: ${verification.hostname} from ${this.getClientIp(request)}`,
        );
        return false;
      }

      this.logger.debug(
        `reCAPTCHA passed with score: ${verification.score} from ${this.getClientIp(request)}`,
      );
      return true;
    } catch (error) {
      this.logger.error('reCAPTCHA verification error:', error);
      return this.failOpen;
    }
  }

  /**
   * 요청에서 reCAPTCHA 토큰 추출
   */
  private extractToken(request: ExtendedRequest): string | null {
    // Body에서 토큰 찾기
    if (request.body?.recaptchaToken) {
      return request.body.recaptchaToken as string;
    }

    if (request.body?.['g-recaptcha-response']) {
      return request.body['g-recaptcha-response'] as string;
    }

    // 헤더에서 토큰 찾기
    const headerToken = request.headers['x-recaptcha-token'];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }

    return null;
  }

  /**
   * Google reCAPTCHA API로 토큰 검증
   */
  private async verifyToken(token: string, request: ExtendedRequest): Promise<any> {
    const payload = {
      secret: this.secretKey,
      response: token,
      remoteip: this.getClientIp(request),
    };

    const response = await this.httpService.postForm(this.verifyUrl, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  /**
   * 호스트명 유효성 검사
   */
  private isValidHostname(hostname: string): boolean {
    const allowedHostnames = this.configService.get<string[]>('app.recaptcha.allowedHostnames', []);
    
    if (allowedHostnames.length === 0) {
      return true; // 제한 없음
    }

    return allowedHostnames.includes(hostname);
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    return 'reCAPTCHA verification failed';
  }
}
