import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { BaseSecurityGuard } from './base-security.guard';
import { ConfigService } from '../services/config.service';

/**
 * Honeypot Guard
 * 숨겨진 폼 필드를 사용하여 봇을 탐지
 */
@Injectable()
export class HoneypotGuard extends BaseSecurityGuard {
  protected readonly logger = new Logger(HoneypotGuard.name);
  
  private readonly honeypotFieldName: string;
  private readonly timeThreshold: number;

  constructor(private readonly configService: ConfigService) {
    super();
    
    this.honeypotFieldName = this.configService.get<string>(
      'app.honeypot.fieldName',
      'email_confirm',
    );
    
    this.timeThreshold = this.configService.get<number>(
      'app.honeypot.timeThreshold',
      2000, // 2초
    );
    
    this.logger.log(
      `Initialized with field: ${this.honeypotFieldName}, time threshold: ${this.timeThreshold}ms`,
    );
  }

  protected getGuardName(): string {
    return 'HoneypotGuard';
  }

  protected validateRequest(request: Request): boolean {
    // POST, PUT, PATCH 요청에만 적용
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return true;
    }

    const body = request.body;
    if (!body) {
      return true;
    }

    // Honeypot 필드 체크
    if (body[this.honeypotFieldName]) {
      this.logger.warn(
        `Honeypot field filled: ${this.honeypotFieldName} from ${this.getClientIp(request)}`,
      );
      return false;
    }

    // 시간 기반 검증 (너무 빠른 제출 감지)
    if (body._timestamp) {
      const submissionTime = Date.now() - parseInt(body._timestamp, 10);
      if (submissionTime < this.timeThreshold) {
        this.logger.warn(
          `Form submitted too quickly: ${submissionTime}ms from ${this.getClientIp(request)}`,
        );
        return false;
      }
    }

    // JavaScript 토큰 검증 (JavaScript가 활성화되어 있는지 확인)
    if (body._jsToken) {
      const expectedToken = this.generateJsToken(request);
      if (body._jsToken !== expectedToken) {
        this.logger.warn(
          `Invalid JavaScript token from ${this.getClientIp(request)}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * JavaScript 토큰 생성
   * 클라이언트 측 JavaScript에서 동일한 로직으로 생성해야 함
   */
  private generateJsToken(request: Request): string {
    const userAgent = this.getUserAgent(request);
    const timestamp = Math.floor(Date.now() / 60000); // 분 단위
    
    // 간단한 토큰 생성 (실제로는 더 복잡한 로직 사용)
    const token = Buffer.from(`${userAgent}-${timestamp}`).toString('base64');
    return token.substring(0, 16);
  }

  protected getFailureMessage(request: Request): string {
    return 'Honeypot validation failed - potential bot detected';
  }
}
