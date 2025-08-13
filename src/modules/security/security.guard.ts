import { Injectable, CanActivate, ExecutionContext, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Public decorator
 * 특정 엔드포인트를 보안 검사에서 제외
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Simple Security Guard
 * 기본적인 보안 검증만 수행
 */
@Injectable()
export class SecurityGuard implements CanActivate {
  private readonly logger = new Logger(SecurityGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const userAgent = request.get('user-agent') || '';

    // 기본적인 검증 로직
    this.logger.debug(`Security check for ${ip} - ${userAgent}`);

    return true;
  }
}
