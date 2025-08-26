import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator
 * 인증이 필요하지 않은 엔드포인트에 사용
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Roles Decorator
 * 특정 역할이 필요한 엔드포인트에 사용
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/**
 * Current User Decorator
 * 현재 로그인한 사용자 정보를 주입
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './guards/auth.guards';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
