import { Module } from '@nestjs/common';

// Controllers - 리팩토링된 통합 컨트롤러
import { PublicController } from './public.controller';
import { UnifiedProtectedController } from './unified-protected.controller';
import { AdminController } from './admin.controller';
import { TestController } from './test.controller';

// Legacy Controllers (점진적 마이그레이션을 위해 임시 유지)
// import { ProtectedController } from './protected.controller';
// import { ImprovedProtectedController } from './improved-protected.controller';
// import { SecureController } from './secure.controller';

// Services
import { BusinessService } from '../services/business.service';
import { TestingBusinessService } from '../services/testing/testing-business.service';
import { ControllerHelperService } from '../common/services/controller-helper.service';

// Common Module for shared services and guards
import { CommonModule } from '../common/common.module';

/**
 * Controllers Module
 * 모든 기능별 컨트롤러를 관리하는 모듈
 * 
 * 리팩토링 완료:
 * - ProtectedController, ImprovedProtectedController, SecureController
 *   → UnifiedProtectedController로 통합
 * - 공통 로직 → ControllerHelperService로 이동
 */
@Module({
  imports: [CommonModule],
  controllers: [
    PublicController,
    UnifiedProtectedController,  // 통합된 컨트롤러
    AdminController,
    TestController,
    // Legacy controllers - 필요시 주석 해제
    // ProtectedController,
    // ImprovedProtectedController,
    // SecureController,
  ],
  providers: [
    BusinessService,
    TestingBusinessService,
    ControllerHelperService,  // 새로운 헬퍼 서비스
  ],
  exports: [
    BusinessService,
    TestingBusinessService,
    ControllerHelperService,
  ],
})
export class ControllersModule {}