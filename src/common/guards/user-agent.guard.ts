import { Injectable, Logger, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../core/config/config.service';
import { BaseSecurityGuard } from './base-security.guard';
import { SecurityEventService } from '../services/security-event.service';
import { ExtendedRequest } from '../../core/types';
import { InvalidUserAgentException } from '../exceptions';
import { SUSPICIOUS_UA_PATTERNS, ALLOWED_BOTS } from '../constants/security.constants';

/**
 * User-Agent 체크를 건너뛰는 데코레이터
 */
const SKIP_USER_AGENT_KEY = 'skipUserAgent';
export const SkipUserAgent = () => SetMetadata(SKIP_USER_AGENT_KEY, true);

/**
 * User-Agent Guard
 * 악성 User-Agent를 차단하는 가드
 */
@Injectable()
export class UserAgentGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(UserAgentGuard.name);
  private readonly blockedUserAgents: string[];
  private readonly strictMode: boolean;

  constructor(
    private readonly configService: AppConfigService,
    private readonly securityEventService: SecurityEventService,
    private readonly reflector: Reflector,
  ) {
    super();

    const userAgentConfig = this.configService.userAgentConfig;
    this.blockedUserAgents = userAgentConfig.blockedAgents
      .map(agent => agent.trim().toLowerCase())
      .filter(agent => agent.length > 0);

    this.strictMode = userAgentConfig.strictMode;

    this.logger.log(`Initialized with ${this.blockedUserAgents.length} blocked agents, strict mode: ${this.strictMode}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipUserAgent() 데코레이터가 있으면 건너뜀
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_USER_AGENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const userAgent = this.getUserAgent(request);

    try {
      const isValid = this.isValidUserAgent(request);

      if (!isValid) {
        this.logSecurityViolation(request, `Invalid User-Agent detected: ${userAgent.substring(0, 100)}`);

        this.securityEventService.log({
          eventType: 'USER_AGENT_BLOCKED',
          severity: 'MEDIUM',
          ip: this.getClientIp(request),
          userAgent,
          endpoint: request.url,
          method: request.method,
          description: `Blocked User-Agent: ${userAgent.substring(0, 200)}`,
        });

        throw new InvalidUserAgentException(userAgent);
      }

      return true;
    } catch (error) {
      if (error instanceof InvalidUserAgentException) {
        throw error;
      }
      this.logger.error(`Unexpected error in User-Agent check:`, error);
      return true; // fail-open
    }
  }

  private isValidUserAgent(request: ExtendedRequest): boolean {
    const userAgent = this.getUserAgent(request).toLowerCase();

    if (!userAgent || userAgent.length === 0) {
      if (this.strictMode) {
        this.logger.warn('Empty User-Agent blocked in strict mode');
        return false;
      }
      return true;
    }

    // ALLOWED_BOTS 체크를 먼저! (Googlebot 등 검색엔진 보호)
    const isAllowedBot = ALLOWED_BOTS.some(bot => userAgent.includes(bot));
    if (isAllowedBot) return true;

    // 그 다음 blockedAgents 체크
    if (this.blockedUserAgents.some(blocked => userAgent.includes(blocked))) {
      return false;
    }

    // strict mode 패턴 체크
    if (this.strictMode) {
      const isSuspicious = SUSPICIOUS_UA_PATTERNS.some(pattern => pattern.test(userAgent));
      if (isSuspicious) {
        this.logger.warn(`Suspicious User-Agent pattern detected: ${userAgent.substring(0, 100)}`);
        return false;
      }
    }

    return true;
  }
}
