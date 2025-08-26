import { Module } from '@nestjs/common';

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
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
