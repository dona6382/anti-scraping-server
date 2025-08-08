import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { BaseGuard } from './base.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { IpExtractor, LogUtil } from '../utils/security.utils';
import { ERROR_MESSAGES } from '../constants/security.constants';
import { GuardType } from '../types/security.types';

/**
 * IP 블랙리스트 Guard (리팩토링)
 */
@Injectable()
export class IpBlacklistGuard extends BaseGuard {
  protected readonly logger = new Logger(IpBlacklistGuard.name);
  protected readonly guardName = GuardType.IP_BLACKLIST;

  constructor(private readonly ipBlacklistService: IpBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ip = this.extractIp(context);
    const path = this.getPath(context);

    if (!ip) {
      this.warn('Could not extract IP from request', { path });
      return true; // Allow if we can't determine IP
    }

    // Check if IP is blacklisted
    const isBlacklisted = await this.ipBlacklistService.isBlacklisted(ip);

    if (isBlacklisted) {
      const ipInfo = await this.ipBlacklistService.getIpInfo(ip);

      this.block(
        'IP blacklisted',
        {
          ip,
          reason: ipInfo?.reason || 'unknown',
          ttl: ipInfo?.ttl || 'permanent',
          path,
        },
        ERROR_MESSAGES.IP_BLOCKED,
      );
    }

    // Check for proxy headers (optional - log only)
    if (IpExtractor.hasProxyHeaders(this.getRequest(context))) {
      this.debug('Proxy headers detected', {
        ip: LogUtil.maskIp(ip),
        path,
      });

      // Store proxy info in metadata
      this.setRequestMetadata(context, 'hasProxy', true);
    }

    // Check if IP is private (optional - log only)
    if (IpExtractor.isPrivate(ip)) {
      this.debug('Private IP detected', {
        ip: LogUtil.maskIp(ip),
        path,
      });

      this.setRequestMetadata(context, 'isPrivateIp', true);
    }

    // Store IP info in metadata
    this.setRequestMetadata(context, 'ip', {
      address: ip,
      hasProxy: IpExtractor.hasProxyHeaders(this.getRequest(context)),
      isPrivate: IpExtractor.isPrivate(ip),
    });

    return true;
  }
}
