import { Injectable, Logger, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { BaseSecurityGuard } from './base-security.guard';
import { RequestUtils } from '../utils/request.utils';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { SecurityEventService } from '../services/security-event.service';
import { ExtendedRequest } from '../../core/types';
import { IpBlockedException } from '../exceptions/application.exception';
import { ThreatScoreService } from '../services/threat-score.service';

/**
 * IP Blacklist 체크를 건너뛰는 데코레이터
 */
const SKIP_IP_BLACKLIST_KEY = 'skipIpBlacklist';
export const SkipIpBlacklist = () => SetMetadata(SKIP_IP_BLACKLIST_KEY, true);

/**
 * IP Blacklist Guard
 * Enhanced security implementation with privacy protection
 * 전역 APP_GUARD로 등록되어 모든 요청에 적용
 */
@Injectable()
export class IpBlacklistGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(IpBlacklistGuard.name);
  private readonly ipHashSalt: string;

  constructor(
    private readonly ipBlacklistService: IpBlacklistService,
    private readonly securityEventService: SecurityEventService,
    private readonly threatScoreService: ThreatScoreService,
    private readonly reflector: Reflector,
  ) {
    super();
    this.ipHashSalt = process.env.IP_HASH_SALT || randomUUID();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipIpBlacklist() 데코레이터가 있으면 건너뜀
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_IP_BLACKLIST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCheck) {
      return true;
    }
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);
    
    try {
      const isBlocked = await this.ipBlacklistService.isBlocked(ip);
      
      if (isBlocked) {
        // 차단 이유는 로깅만 하고 클라이언트에는 노출하지 않음
        const reason = await this.ipBlacklistService.getBlockReason(ip);

        this.logger.warn(`IP blocked`, {
          ip: this.hashIp(ip),
          reason,
          userAgent: this.sanitizeUserAgent(request),
          path: request.url,
        });

        // 보안 이벤트 DB 기록
        this.securityEventService.log({
          eventType: 'IP_BLOCKED',
          severity: 'HIGH',
          ip,
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: `Blocked IP access attempt: ${reason}`,
          actions: { blocked: true, notified: false, escalated: false, autoResolved: false },
        });

        throw new IpBlockedException(this.hashIp(ip), 'Security policy');
      }

      // CIDR 범위 차단 확인
      const cidrResult = await this.ipBlacklistService.isIpInBlockedCidr(ip);
      if (cidrResult.blocked) {
        this.securityEventService.log({
          eventType: 'IP_BLOCKED',
          severity: 'HIGH',
          ip,
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: `IP in blocked CIDR range: ${cidrResult.cidr}`,
        });

        throw new IpBlockedException(this.hashIp(ip), 'IP in blocked range');
      }

      // Threat score based preemptive blocking
      const shouldPreemptiveBlock = await this.threatScoreService.shouldPreemptiveBlock(ip);
      if (shouldPreemptiveBlock) {
        await this.ipBlacklistService.blockIp(ip, 'SUSPICIOUS_BEHAVIOR', 3600);

        this.securityEventService.log({
          eventType: 'AUTO_BLOCKED',
          severity: 'HIGH',
          ip,
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: 'Preemptive block: threat score exceeded threshold',
        });

        throw new IpBlockedException(this.hashIp(ip), 'Threat score exceeded');
      }

      return true;
    } catch (error) {
      if (error instanceof IpBlockedException) {
        throw error;
      }
      
      // 서비스 에러 시 fail-open (서비스 장애가 전체 서비스 중단으로 이어지지 않도록)
      this.logger.error(`IP blacklist check failed - allowing request (fail-open)`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: this.hashIp(ip),
      });

      return true;
    }
  }

  private hashIp(ip: string): string {
    return RequestUtils.hashIp(ip, this.ipHashSalt);
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