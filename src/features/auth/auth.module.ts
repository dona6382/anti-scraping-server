import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';
import { User } from '../../core/database/entities';
import { AppConfigService } from '../../core/config/config.service';

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
      useFactory: (configService: AppConfigService) => ({
        secret: process.env.JWT_SECRET || 'anti-scraping-server-jwt-secret-key-change-in-production',
        signOptions: {
          expiresIn: '1h',
          issuer: 'anti-scraping-server',
        },
      }),
      inject: [AppConfigService],
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
