import { Module } from '@nestjs/common';

import { TestingController } from './testing.controller';
import { TestingService } from './testing.service';

/**
 * Testing Feature Module
 * 
 * 시스템 테스트 기능:
 * - 보안 가드 테스트
 * - 허니팟 테스트
 * - 캐시 시스템 테스트
 * - 성능 테스트
 * - 에러 처리 테스트
 */
@Module({
  controllers: [TestingController],
  providers: [TestingService],
  exports: [TestingService],
})
export class TestingModule {}
