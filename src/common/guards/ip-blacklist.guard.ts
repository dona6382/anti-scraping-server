import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { ExtendedRequest } from '../../types';
import { IpBlockedException } from '../exceptions';

/**
 * IP Blacklist Guard
 * 차단된 IP 주소로부터의 접근을 막는 가드
 */
@Injectable()
export class IpBlacklistGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(IpBlacklistGuard.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {
    super();
  }

  /**
   * canActivate 메서드 구현
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);
    
    try {
      const isValid = await this.validateRequest(request);
      
      if (!isValid) {
        const reason = await this.ipBlacklistService.getBlockReason(ip);
        
        // 보안 위반 로깅 (내부용)
        this.logSecurityViolation(request, `IP blocked: ${reason || 'Unknown reason'}`);
        
        // 통합된 예외 발생 (null을 undefined로 변환)
        throw new IpBlockedException(ip, reason ?? undefined);
      }
      
      return true;
    } catch (error) {
      // 이미 우리의 예외인 경우 그대로 전달
      if (error instanceof IpBlockedException) {
        throw error;
      }
      
      // 예상치 못한 에러 로깅
      this.logger.error(`Unexpected error in IP check for ${ip}:`, error);
      
      // 프로덕션에서는 fail-open, 개발에서는 fail-closed
      if (process.env.NODE_ENV === 'production') {
        return true; // fail-open: 에러 시 허용
      }
      
      throw new IpBlockedException(ip, 'Service error');
    }
  }

  protected getGuardName(): string {
    return 'IpBlacklistGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const ip = this.getClientIp(request);
    
    // IP 유효성 검사
    if (!this.isValidIpAddress(ip) || ip === 'unknown') {
      this.logger.warn(`Invalid IP address: ${ip}`);
      return false;
    }
    
    // IP 차단 여부 확인
    const isBlocked = await this.ipBlacklistService.isBlocked(ip);
    
    return !isBlocked;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    // 이 메서드는 더 이상 직접 사용되지 않음 (예외 시스템 사용)
    return 'Access denied';
  }
}
