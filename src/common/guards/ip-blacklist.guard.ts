import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { BaseSecurityGuard } from './base-security.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';

/**
 * IP Blacklist Guard
 * 차단된 IP 주소로부터의 접근을 막는 가드
 */
@Injectable()
export class IpBlacklistGuard extends BaseSecurityGuard {
  protected readonly logger = new Logger(IpBlacklistGuard.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {
    super();
  }

  protected getGuardName(): string {
    return 'IpBlacklistGuard';
  }

  protected async validateRequest(request: Request): Promise<boolean> {
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

  protected getFailureMessage(request: Request): string {
    const ip = this.getClientIp(request);
    return `IP address ${ip} is blocked`;
  }
}
