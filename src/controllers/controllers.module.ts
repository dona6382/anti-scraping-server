import { Module } from '@nestjs/common';

// Controllers - 정리된 컨트롤러들
import { PublicController } from './public.controller';
import { UnifiedProtectedController } from './unified-protected.controller';
import { TestController } from './test.controller';
import { SecureController } from './secure.controller';

// Services
import { BusinessService } from '../services/business.service';
import { ControllerHelperService } from '../common/services/controller-helper.service';

// Common Module for shared services and guards
import { CommonModule } from '../common/common.module';

/**
 * Controllers Module
 * 중복 제거된 컨트롤러들을 관리하는 모듈
 * 
 * 정리 완료:
 * ✅ ProtectedController → 제거 (중복)
 * ✅ ImprovedProtectedController → 제거 (중복)
 * ✅ AdminController → features/admin으로 이동
 * ✅ UnifiedProtectedController → 유지 (최신)
 */
@Module({
  imports: [CommonModule],
  controllers: [
    PublicController,
    UnifiedProtectedController,  // 통합된 protected API
    TestController,
    SecureController,
  ],
  providers: [
    BusinessService,
    ControllerHelperService,
  ],
  exports: [
    BusinessService,
    ControllerHelperService,
  ],
})
export class ControllersModule {}