import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { HealthModule } from '../health/health.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin Feature Module
 *
 * 관리자 기능:
 * - 시스템 정보 조회
 * - 보안 이벤트 모니터링
 * - 설정 관리
 * - 시스템 제어
 *
 * JWT 인증 + admin 역할 필요
 */
@Module({
  imports: [AuthModule, HealthModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
