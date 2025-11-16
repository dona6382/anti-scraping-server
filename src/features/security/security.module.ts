import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';

// Controllers
import { SecurityAdminController } from './controllers/security-admin.controller';

// Services는 CommonModule에서 제공됨

/**
 * Security Feature Module
 * 
 * 보안 관련 모든 기능을 담당:
 * - IP 블랙리스트 관리
 * - 보안 통계
 * - 관리자 기능
 */
@Module({
  imports: [
    CommonModule, // IpBlacklistService를 여기서 가져옴
  ],
  controllers: [
    SecurityAdminController,
  ],
  providers: [
    // 중복 서비스 제거 - CommonModule에서 제공
  ],
  exports: [],
})
export class SecurityModule {}
