import { Module } from '@nestjs/common';

// Controllers
import { PublicController } from './public.controller';
import { ProtectedController } from './protected.controller';
import { AdminController } from './admin.controller';
import { SecureController } from './secure.controller';
import { TestController } from './test.controller';

// Services
import { BusinessService } from '../services/business.service';

// Common Module for shared services and guards
import { CommonModule } from '../common/common.module';

/**
 * Controllers Module
 * 모든 기능별 컨트롤러를 관리하는 모듈
 */
@Module({
  imports: [CommonModule],
  controllers: [
    PublicController,
    ProtectedController,
    AdminController,
    SecureController,
    TestController,
  ],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class ControllersModule {}
