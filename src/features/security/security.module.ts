import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

// Controllers
import { SecurityAdminController } from './controllers/security-admin.controller';

/**
 * Security Feature Module
 *
 * 보안 관련 모든 기능을 담당:
 * - IP 블랙리스트 관리
 * - 보안 통계
 * - 관리자 기능
 *
 * JWT 인증 + admin 역할 필요
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
  ],
  controllers: [
    SecurityAdminController,
  ],
})
export class SecurityModule {}
