import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseSecurityGuard } from './base-security.guard';
import { ExtendedRequest } from '../../types';
import { InvalidUserAgentException } from '../exceptions';

/**
 * User-Agent Guard
 * 악성 User-Agent를 차단하는 가드
 */
@Injectable()
export class UserAgentGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(UserAgentGuard.name);
  private readonly blockedUserAgents: string[];
  private readonly strictMode: boolean;

  constructor(private readonly configService: ConfigService) {
    super();
    
    // 차단할 User-Agent 목록 로드
    const blockedAgents = this.configService.get<string>('BLOCKED_USER_AGENTS', '');
    this.blockedUserAgents = blockedAgents
      .split(',')
      .map(agent => agent.trim().toLowerCase())
      .filter(agent => agent.length > 0);

    this.strictMode = this.configService.get<boolean>('SECURITY_STRICT_MODE', false);

    this.logger.log(`Initialized with ${this.blockedUserAgents.length} blocked agents, strict mode: ${this.strictMode}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const ip = this.getClientIp(request);
    const userAgent = this.getUserAgent(request);

    try {
      const isValid = await this.validateRequest(request);
      
      if (!isValid) {
        // 보안 위반 로깅 (내부용)
        this.logSecurityViolation(request, `Invalid User-Agent detected: ${userAgent.substring(0, 100)}`);
        
        // 통합된 예외 발생
        throw new InvalidUserAgentException(ip, userAgent);
      }
      
      return true;
    } catch (error) {
      // 이미 우리의 예외인 경우 그대로 전달
      if (error instanceof InvalidUserAgentException) {
        throw error;
      }
      
      // 예상치 못한 에러
      this.logger.error(`Unexpected error in User-Agent check:`, error);
      
      // 에러 시 허용 (fail-open)
      return true;
    }
  }

  protected getGuardName(): string {
    return 'UserAgentGuard';
  }

  protected async validateRequest(request: ExtendedRequest): Promise<boolean> {
    const userAgent = this.getUserAgent(request).toLowerCase();

    // User-Agent가 없는 경우
    if (!userAgent || userAgent.length === 0) {
      if (this.strictMode) {
        this.logger.warn('Empty User-Agent blocked in strict mode');
        return false;
      }
      return true;
    }

    // 차단된 User-Agent 검사
    const isBlocked = this.blockedUserAgents.some(blocked => 
      userAgent.includes(blocked)
    );

    if (isBlocked) {
      return false;
    }

    // 추가 의심스러운 패턴 검사 (strict mode에서만)
    if (this.strictMode) {
      const suspiciousPatterns = [
        /bot/i,
        /spider/i,
        /crawl/i,
        /scrape/i,
        /harvest/i,
        /extract/i,
        /grab/i,
        /fetch/i,
        /mine/i,
        /scan/i,
      ];

      // 알려진 정상 봇 제외
      const allowedBots = [
        'googlebot',
        'bingbot',
        'slackbot',
        'twitterbot',
        'facebookexternalhit',
        'linkedinbot',
        'whatsapp',
        'telegram',
      ];

      const isAllowedBot = allowedBots.some(bot => userAgent.includes(bot));
      
      if (!isAllowedBot) {
        const isSuspicious = suspiciousPatterns.some(pattern => 
          pattern.test(userAgent)
        );
        
        if (isSuspicious) {
          this.logger.warn(`Suspicious User-Agent pattern detected: ${userAgent.substring(0, 100)}`);
          return false;
        }
      }
    }

    return true;
  }

  protected getFailureMessage(request: ExtendedRequest): string {
    // 이 메서드는 더 이상 직접 사용되지 않음 (예외 시스템 사용)
    return 'Access denied';
  }
}
