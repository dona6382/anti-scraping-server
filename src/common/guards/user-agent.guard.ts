import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';

// 설정 타입 정의
interface UserAgentConfig {
  blockedUserAgents: string[];
}

@Injectable()
export class UserAgentGuard implements CanActivate {
  private readonly logger = new Logger(UserAgentGuard.name);
  private readonly blockedUserAgents: Set<string>;

  constructor(
    @Inject('CONFIG') private readonly config: UserAgentConfig
  ) {
    this.blockedUserAgents = new Set(
      config.blockedUserAgents.map(agent => agent.toLowerCase())
    );
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const userAgent = request.headers['user-agent'];

    if (!userAgent) {
      this.logger.warn('Missing User-Agent header');
      throw new ForbiddenException('Invalid request');
    }

    const normalizedUserAgent = userAgent.toLowerCase();
    if (this.isBlockedUserAgent(normalizedUserAgent)) {
      this.logger.warn(`Blocked request from user agent: ${userAgent}`);
      throw new ForbiddenException('Invalid request');
    }

    return true;
  }

  private isBlockedUserAgent(userAgent: string): boolean {
    return Array.from(this.blockedUserAgents).some(blocked => 
      userAgent === blocked || userAgent.includes(blocked)
    );
  }
}