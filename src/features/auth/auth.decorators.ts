import { SetMetadata } from '@nestjs/common';

/**
 * Roles Decorator
 * 특정 역할이 필요한 엔드포인트에 사용
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
