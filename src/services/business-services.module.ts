import { Module } from '@nestjs/common';

// 실제 존재하는 서비스만 import
import { BusinessService } from './business.service';

// Common 모듈의 서비스들도 필요
import { CommonModule } from '../common/common.module';

/**
 * Business Services Module
 * 정리된 비즈니스 서비스들을 관리
 * 
 * Note: 중복된 services/admin, services/security 등은 
 * features/ 모듈로 이동되었습니다.
 */
@Module({
  imports: [CommonModule],
  providers: [
    BusinessService,
  ],
  exports: [
    BusinessService,
  ],
})
export class BusinessServicesModule {}