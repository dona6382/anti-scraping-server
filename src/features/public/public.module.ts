import { Module } from '@nestjs/common';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';

/**
 * Public Feature Module
 * 
 * 공개 API 기능:
 * - 데이터 조회
 * - 검색 API
 * - 공개 통계
 * - 카테고리 관리
 */
@Module({
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
