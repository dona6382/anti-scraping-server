import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { ExtendedRequest } from '../../types';

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
    return this.validateRequest(request);
  }

  protected getGuardName(): string {
    return 'IpBlacklistGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const ip = this.getClientIp(request);
    
    // IP 차단 여부 확인
    const isBlocked = await this.ipBlacklistService.isBlocked(ip);
    
    if (isBlocked) {
      const reason = await this.ipBlacklistService.getBlockReason(ip);
      this.logger.warn(`Blocked IP: ${ip}, Reason: ${reason}`);
      return false;
    }

    return true;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    const ip = this.getClientIp(request);
    return `IP address ${ip} is blocked`;
  }
}
