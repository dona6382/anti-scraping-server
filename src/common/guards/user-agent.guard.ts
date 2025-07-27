import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class UserAgentGuard implements CanActivate {
  private readonly logger = new Logger(UserAgentGuard.name);
  private readonly blockedUserAgents: Set<string>;

  constructor(
    @Inject('CONFIG') private readonly config: { blockedUserAgents: string[] }
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

    if (this.isBlockedUserAgent(userAgent.toLowerCase())) {
      this.logger.warn('Blocked request');
      throw new ForbiddenException('Invalid request');
    }

    return true;
  }

  private isBlockedUserAgent(userAgent: string): boolean {
    return this.blockedUserAgents.has(userAgent) ||
      Array.from(this.blockedUserAgents).some(blocked => userAgent.includes(blocked));
  }
}