import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class UserAgentGuard implements CanActivate {
  private readonly logger = new Logger(UserAgentGuard.name);
  private readonly blockedUserAgents: string[] = [
    'curl',
    'python-requests',
    'scrapy',
    'postman', // 테스트 시에는 주석 처리
    'go-http-client',
  ];

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip;

    // 1. User-Agent 필터링
    for (const blockedAgent of this.blockedUserAgents) {
      if (userAgent.toLowerCase().includes(blockedAgent.toLowerCase())) {
        this.logger.warn(
          `[Blocked] Suspicious User-Agent: ${userAgent} from IP: ${ip}`,
        );
        throw new ForbiddenException(
          'Access denied due to suspicious User-Agent.',
        );
      }
    }

    // 2. 필수 헤더 검증 (예: Accept-Language)
    // 브라우저가 아닌 요청은 이 헤더가 없는 경우가 많음
    const acceptLanguage = request.headers['accept-language'];
    if (!acceptLanguage) {
      this.logger.warn(
        `[Blocked] Missing Accept-Language header from IP: ${ip}, User-Agent: ${userAgent}`,
      );
      throw new ForbiddenException('Access denied due to missing headers.');
    }

    return true;
  }
}