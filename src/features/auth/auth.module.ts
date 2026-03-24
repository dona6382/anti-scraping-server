import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';
import { User } from '../../core/database/entities';

/**
 * Auth Feature Module
 * 
 * JWT 인증 시스템:
 * - 로그인/로그아웃
 * - 사용자 관리
 * - 역할 기반 접근 제어 (RBAC)
 * - 프로필 관리
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
            issuer: 'anti-scraping-server',
          },
          verifyOptions: {
            algorithms: ['HS256' as const],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
