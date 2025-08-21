import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseSecurityGuard } from './base-security.guard';
import { ExtendedRequest, RecaptchaVerificationResponse } from '../../types';
import { RecaptchaException, ConfigurationException, ExternalServiceException } from '../exceptions';
import { HttpService } from '../services/http.service';

/**
 * reCAPTCHA Guard
 * Google reCAPTCHA v3를 사용한 봇 검증
 */
@Injectable()
export class RecaptchaGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(RecaptchaGuard.name);
  private readonly secretKey: string | undefined;
  private readonly scoreThreshold: number;
  private readonly failOpen: boolean;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    super();
    
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    this.scoreThreshold = this.configService.get<number>('RECAPTCHA_SCORE_THRESHOLD', 0.5);
    this.failOpen = this.configService.get<boolean>('RECAPTCHA_FAIL_OPEN', false);

    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured');
    } else {
      this.logger.log(`Initialized with score threshold: ${this.scoreThreshold}, fail-open: ${this.failOpen}`);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);

    // reCAPTCHA가 설정되지 않은 경우
    if (!this.secretKey) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('reCAPTCHA not configured in production');
        throw new ConfigurationException('RECAPTCHA_SECRET_KEY');
      }
      // 개발 환경에서는 통과
      return true;
    }

    try {
      const isValid = await this.validateRequest(request);
      
      if (!isValid) {
        // 보안 위반 로깅 (내부용)
        this.logSecurityViolation(request, 'reCAPTCHA verification failed');
        
        // 통합된 예외 발생
        throw new RecaptchaException(ip);
      }
      
      return true;
    } catch (error) {
      // 이미 우리의 예외인 경우 그대로 전달
      if (error instanceof RecaptchaException || error instanceof ConfigurationException) {
        throw error;
      }
      
      // 외부 서비스 에러
      this.logger.error(`reCAPTCHA service error:`, error);
      
      if (this.failOpen) {
        // fail-open: 에러 시 허용
        this.logger.warn('reCAPTCHA failed but allowing request (fail-open mode)');
        return true;
      }
      
      // fail-closed: 에러 시 차단
      throw new ExternalServiceException('reCAPTCHA', error as Error);
    }
  }

  protected getGuardName(): string {
    return 'RecaptchaGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    // POST, PUT, PATCH 요청에만 적용
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return true;
    }

    // reCAPTCHA 토큰 추출
    const token = this.extractRecaptchaToken(request);
    
    if (!token) {
      this.logger.warn('reCAPTCHA token not found in request');
      return false;
    }

    // 토큰 검증
    const verificationResult = await this.verifyToken(token, this.getClientIp(request));
    
    if (!verificationResult.success) {
      this.logger.warn('reCAPTCHA verification failed', {
        errors: verificationResult['error-codes'],
      });
      return false;
    }

    // 점수 확인
    if (verificationResult.score < this.scoreThreshold) {
      this.logger.warn(`reCAPTCHA score too low: ${verificationResult.score} < ${this.scoreThreshold}`);
      return false;
    }

    // 호스트네임 확인 (옵션)
    const allowedHostnames = this.configService.get<string>('RECAPTCHA_ALLOWED_HOSTNAMES');
    if (allowedHostnames) {
      const hostnames = allowedHostnames.split(',').map(h => h.trim());
      if (!hostnames.includes(verificationResult.hostname)) {
        this.logger.warn(`Invalid hostname: ${verificationResult.hostname}`);
        return false;
      }
    }

    this.logger.debug(`reCAPTCHA verified successfully. Score: ${verificationResult.score}`);
    return true;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    // 이 메서드는 더 이상 직접 사용되지 않음 (예외 시스템 사용)
    return 'Access denied';
  }

  /**
   * reCAPTCHA 토큰 추출
   */
  private extractRecaptchaToken(request: ExtendedRequest): string | undefined {
    // 1. 헤더에서 확인
    const headerToken = this.getHeader(request, 'x-recaptcha-token');
    if (headerToken) {
      return headerToken;
    }

    // 2. 바디에서 확인
    const body = this.getRequestBody(request);
    if (body.recaptchaToken && typeof body.recaptchaToken === 'string') {
      return body.recaptchaToken;
    }

    // 3. 쿼리 파라미터에서 확인 (권장하지 않음)
    const query = this.getQueryParams(request);
    if (query.recaptchaToken && typeof query.recaptchaToken === 'string') {
      return query.recaptchaToken;
    }

    return undefined;
  }

  /**
   * reCAPTCHA 토큰 검증
   */
  private async verifyToken(
    token: string,
    remoteIp: string
  ): Promise<RecaptchaVerificationResponse> {
    try {
      const response = await this.httpService.post<RecaptchaVerificationResponse>(
        this.verifyUrl,
        {
          secret: this.secretKey,
          response: token,
          remoteip: remoteIp,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to verify reCAPTCHA token', error);
      throw error;
    }
  }
}
