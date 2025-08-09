import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { BaseSecurityGuard } from './base-security.guard';
import { ConfigService } from '../services/config.service';
import { HttpService } from '../services/http.service';

/**
 * reCAPTCHA v3 Guard
 * Google reCAPTCHA v3를 사용하여 봇을 탐지
 */
@Injectable()
export class RecaptchaGuard extends BaseSecurityGuard {
  protected readonly logger = new Logger(RecaptchaGuard.name);
  
  private readonly secretKey: string;
  private readonly scoreThreshold: number;
  private readonly failOpen: boolean;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
    
    this.secretKey = this.configService.get<string>('app.recaptcha.secretKey', '');
    this.scoreThreshold = this.configService.get<number>('app.recaptcha.scoreThreshold', 0.5);
    this.failOpen = this.configService.get<boolean>('app.recaptcha.failOpen', false);
    
    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured - guard will be bypassed');
    } else {
      this.logger.log(
        `Initialized with score threshold: ${this.scoreThreshold}, fail-open: ${this.failOpen}`,
      );
    }
  }

  protected getGuardName(): string {
    return 'RecaptchaGuard';
  }

  protected async validateRequest(request: Request): Promise<boolean> {
    // reCAPTCHA가 설정되지 않은 경우 통과
    if (!this.secretKey) {
      return true;
    }

    // POST, PUT, PATCH 요청에만 적용
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return true;
    }

    const token = this.extractRecaptchaToken(request);
    if (!token) {
      this.logger.warn(`Missing reCAPTCHA token from ${this.getClientIp(request)}`);
      return false;
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

      // 호스트명 검증
      if (verification.hostname && !this.isAllowedHostname(verification.hostname)) {
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
      this.logger.error(`reCAPTCHA verification error: ${error.message}`, error.stack);
      
      // Fail-open 모드인 경우 에러 시 통과
      return this.failOpen;
    }
  }

  /**
   * 요청에서 reCAPTCHA 토큰 추출
   */
  private extractRecaptchaToken(request: Request): string | null {
    // Body에서 확인
    if (request.body && request.body.recaptchaToken) {
      return request.body.recaptchaToken;
    }
    
    // Header에서 확인
    const headerToken = request.get('X-Recaptcha-Token');
    if (headerToken) {
      return headerToken;
    }
    
    return null;
  }

  /**
   * reCAPTCHA 토큰 검증
   */
  private async verifyToken(token: string, request: Request): Promise<any> {
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
      remoteip: this.getClientIp(request),
    });

    const response = await this.httpService.post(this.verifyUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response;
  }

  /**
   * 허용된 호스트명인지 확인
   */
  private isAllowedHostname(hostname: string): boolean {
    const allowedHostnames = this.configService.get<string[]>(
      'app.recaptcha.allowedHostnames',
      [],
    );
    
    if (allowedHostnames.length === 0) {
      return true; // 설정이 없으면 모든 호스트명 허용
    }
    
    return allowedHostnames.includes(hostname);
  }

  protected getFailureMessage(request: Request): string {
    return 'reCAPTCHA validation failed - potential bot detected';
  }
}
