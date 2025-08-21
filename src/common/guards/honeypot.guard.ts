import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseSecurityGuard } from './base-security.guard';
import { ExtendedRequest } from '../../types';
import { HoneypotException } from '../exceptions';

/**
 * Honeypot Guard
 * 숨겨진 필드를 사용하여 봇을 감지
 */
@Injectable()
export class HoneypotGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(HoneypotGuard.name);
  private readonly honeypotFieldName: string;
  private readonly timeThreshold: number;

  constructor(private readonly configService: ConfigService) {
    super();
    
    this.honeypotFieldName = this.configService.get<string>(
      'HONEYPOT_FIELD_NAME',
      'email_confirm'
    );
    
    this.timeThreshold = this.configService.get<number>(
      'HONEYPOT_TIME_THRESHOLD',
      2000 // 2초
    );

    this.logger.log(`Initialized with field: ${this.honeypotFieldName}, threshold: ${this.timeThreshold}ms`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);

    try {
      const validationResult = await this.validateHoneypot(request);
      
      if (!validationResult.isValid) {
        // 보안 위반 로깅 (내부용)
        this.logSecurityViolation(
          request, 
          `Honeypot triggered: ${validationResult.reason}`
        );
        
        // 통합된 예외 발생 (필드명은 노출하지 않음)
        throw new HoneypotException(ip);
      }
      
      return true;
    } catch (error) {
      // 이미 우리의 예외인 경우 그대로 전달
      if (error instanceof HoneypotException) {
        throw error;
      }
      
      // 예상치 못한 에러
      this.logger.error(`Unexpected error in honeypot check:`, error);
      
      // 에러 시 허용 (fail-open)
      return true;
    }
  }

  protected getGuardName(): string {
    return 'HoneypotGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const result = await this.validateHoneypot(request);
    return result.isValid;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    // 이 메서드는 더 이상 직접 사용되지 않음 (예외 시스템 사용)
    return 'Access denied';
  }

  /**
   * Honeypot 검증
   */
  private async validateHoneypot(request: ExtendedRequest): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    // POST, PUT, PATCH 요청에만 적용
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return { isValid: true };
    }

    const body = this.getRequestBody(request);
    
    // 1. Honeypot 필드 검사
    if (body[this.honeypotFieldName]) {
      this.logger.warn(`Honeypot field filled: ${this.honeypotFieldName}`);
      return {
        isValid: false,
        reason: 'Honeypot field filled',
      };
    }

    // 2. 시간 기반 검사 (너무 빠른 제출)
    const submitTime = body._submitTime as number | undefined;
    const renderTime = body._renderTime as number | undefined;
    
    if (submitTime && renderTime) {
      const timeDiff = submitTime - renderTime;
      
      if (timeDiff < this.timeThreshold) {
        this.logger.warn(`Form submitted too quickly: ${timeDiff}ms`);
        return {
          isValid: false,
          reason: `Form submitted in ${timeDiff}ms (threshold: ${this.timeThreshold}ms)`,
        };
      }
    }

    // 3. 추가 숨겨진 필드 검사
    const suspiciousFields = [
      'username_confirm',
      'email_verify',
      'name_check',
      'url_check',
      'website_confirm',
      'phone_verify',
    ];

    const detectedFields = suspiciousFields.filter(field => 
      body[field] !== undefined && body[field] !== ''
    );

    if (detectedFields.length > 0) {
      this.logger.warn(`Suspicious fields detected: ${detectedFields.join(', ')}`);
      return {
        isValid: false,
        reason: `Suspicious fields filled: ${detectedFields.length}`,
      };
    }

    // 4. 중복 필드 검사
    const emailField = body.email as string | undefined;
    const confirmEmailField = body.confirm_email as string | undefined;
    
    if (emailField && confirmEmailField && emailField === confirmEmailField) {
      // 이메일 확인 필드가 자동으로 채워진 경우 (정상적으로는 다를 수 있음)
      const isAutofilled = body._email_autofilled === true;
      if (isAutofilled) {
        this.logger.warn('Email confirmation field appears to be autofilled');
        return {
          isValid: false,
          reason: 'Autofilled confirmation field detected',
        };
      }
    }

    return { isValid: true };
  }
}
