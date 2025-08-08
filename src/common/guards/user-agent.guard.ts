import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { BaseGuard } from './base.guard';
import { RequestContext } from '../types/request.types';
import { UserAgentValidationStrategy } from '../strategies/security.strategies';
import { BLOCKED_USER_AGENTS, SUSPICIOUS_PATTERNS } from '../constants/security.constants';
import { GuardType } from '../types/security.types';

/**
 * User-Agent 기반 차단 Guard (Strategy Pattern 적용)
 */
@Injectable()
export class UserAgentGuard extends BaseGuard {
  protected readonly logger = new Logger(UserAgentGuard.name);
  protected readonly guardName = GuardType.USER_AGENT;

  private readonly strategy: UserAgentValidationStrategy;

  constructor(private readonly configService: ConfigService) {
    super();

    const configuredAgents = this.configService.get<string[]>('app.blockedUserAgents', []);
    const blockedAgents = new Set(
      [...BLOCKED_USER_AGENTS, ...configuredAgents].map((agent) => agent.toLowerCase()),
    );

    const strictMode = this.configService.get<boolean>('app.security.strictMode', false);

    this.strategy = new UserAgentValidationStrategy(
      blockedAgents,
      [...SUSPICIOUS_PATTERNS],
      strictMode,
    );

    this.logger.log(
      `Initialized with ${blockedAgents.size} blocked agents, strict mode: ${strictMode}`,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = this.getRequest(context);
    const requestContext = RequestContext.fromExpressRequest(request);

    const result = this.strategy.validate(requestContext);

    if (!result.passed) {
      this.block(result.reason || 'Validation failed', {
        ip: requestContext.getMaskedIp(),
        path: requestContext.path,
        ...result.details,
      });
    }

    // Store validation result in metadata
    this.setRequestMetadata(context, 'userAgentValidation', {
      passed: true,
      userAgent: requestContext.userAgent,
    });

    this.debug('User-Agent validation passed', {
      ip: requestContext.getMaskedIp(),
      path: requestContext.path,
    });

    return true;
  }
}
