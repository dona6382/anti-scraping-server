import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { ExtendedRequest } from '../../types';
import { IpBlockedException } from '../exceptions/application.exception';

/**
 * IP Blacklist Guard
 * Enhanced security implementation with privacy protection
 * (Unified from basic + enhanced versions)
 */
@Injectable()
export class IpBlacklistGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(IpBlacklistGuard.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);
    
    try {
      const isBlocked = await this.ipBlacklistService.isBlocked(ip);
      
      if (isBlocked) {
        // 차단 이유는 로깅만 하고 클라이언트에는 노출하지 않음
        const reason = await this.ipBlacklistService.getBlockReason(ip);
        
        // 내부 로깅 (상세 정보)
        this.logger.warn(`IP blocked`, {
          ip: this.hashIp(ip), // IP를 해시화하여 로깅
          reason,
          userAgent: this.sanitizeUserAgent(request),
          path: request.url,
        });
        
        // 보안 예외 발생 (최소 정보만 포함)
        throw new IpBlockedException(this.hashIp(ip), 'Security policy');
      }
      
      return true;
    } catch (error) {
      if (error instanceof IpBlockedException) {
        throw error;
      }
      
      // 서비스 에러는 로깅만 하고 fail-open
      this.logger.error(`IP check service error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: this.hashIp(ip),
      });
      
      // Production에서는 fail-open (서비스 장애 시 허용)
      return process.env.NODE_ENV === 'production';
    }
  }

  protected getGuardName(): string {
    return 'IpBlacklistGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const ip = this.getClientIp(request);
    
    if (!this.isValidIpAddress(ip) || ip === 'unknown') {
      // 유효하지 않은 IP는 로깅만
      this.logger.debug(`Invalid IP format: ${this.hashIp(ip)}`);
      return false;
    }
    
    return !(await this.ipBlacklistService.isBlocked(ip));
  }

  protected getFailureMessage(): string {
    // 일반적인 메시지만 반환 (상세 정보 노출 방지)
    return 'Access denied';
  }

  /**
   * IP 해시화 (로깅용)
   */
  private hashIp(ip: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(ip + process.env.IP_HASH_SALT || 'default-salt')
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * User-Agent 정제 (민감 정보 제거)
   */
  private sanitizeUserAgent(request: ExtendedRequest): string {
    const userAgent = this.getUserAgent(request);
    // 버전 정보 제거
    return userAgent
      .replace(/\/[\d.]+/g, '/x.x')
      .substring(0, 100);
  }
}