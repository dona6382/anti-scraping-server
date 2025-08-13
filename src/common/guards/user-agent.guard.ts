import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { BaseSecurityGuard } from './base-security.guard';
import { ConfigurationService } from '../../modules/configuration/configuration.service';
import { BLOCKED_USER_AGENTS, SUSPICIOUS_PATTERNS } from '../constants/security.constants';
import { ExtendedRequest } from '../../types';

/**
 * User-Agent 기반 차단 Guard
 * 악성 봇과 스크래퍼의 User-Agent를 탐지하고 차단
 */
@Injectable()
export class UserAgentGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(UserAgentGuard.name);
  
  private readonly blockedAgents: Set<string>;
  private readonly suspiciousPatterns: RegExp[];
  private readonly strictMode: boolean;

  constructor(private readonly configService: ConfigurationService) {
    super();

    // 설정에서 차단할 User-Agent 목록 로드
    const configuredAgents = this.configService.get<string[]>('app.blockedUserAgents', []);
    this.blockedAgents = new Set(
      [...BLOCKED_USER_AGENTS, ...configuredAgents].map((agent) => agent.toLowerCase()),
    );

    // 의심스러운 패턴 설정
    this.suspiciousPatterns = SUSPICIOUS_PATTERNS.map((pattern) => new RegExp(pattern, 'i'));

    // Strict 모드 설정
    this.strictMode = this.configService.get<boolean>('app.security.strictMode', false);

    this.logger.log(
      `Initialized with ${this.blockedAgents.size} blocked agents, strict mode: ${this.strictMode}`,
    );
  }

  /**
   * canActivate 메서드 구현
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    return this.validateRequest(request);
  }

  protected getGuardName(): string {
    return 'UserAgentGuard';
  }

  protected validateRequest(request: ExtendedRequest): boolean {
    const userAgent = this.getUserAgent(request).toLowerCase();
    
    // User-Agent가 없는 경우
    if (!userAgent || userAgent === '') {
      if (this.strictMode) {
        this.logger.warn(`Blocked request with missing User-Agent from ${this.getClientIp(request)}`);
        return false;
      }
      return true;
    }

    // 차단된 User-Agent 확인
    if (this.isBlockedUserAgent(userAgent)) {
      this.logger.warn(`Blocked User-Agent: ${userAgent} from ${this.getClientIp(request)}`);
      return false;
    }

    // 의심스러운 패턴 확인
    if (this.strictMode && this.hasSuspiciousPattern(userAgent)) {
      this.logger.warn(`Suspicious User-Agent pattern: ${userAgent} from ${this.getClientIp(request)}`);
      return false;
    }

    return true;
  }

  /**
   * 차단된 User-Agent인지 확인
   */
  private isBlockedUserAgent(userAgent: string): boolean {
    // 정확한 매칭
    for (const blocked of this.blockedAgents) {
      if (userAgent.includes(blocked)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 의심스러운 패턴이 있는지 확인
   */
  private hasSuspiciousPattern(userAgent: string): boolean {
    return this.suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    const userAgent = this.getUserAgent(request);
    return `Blocked User-Agent: ${userAgent}`;
  }
}
