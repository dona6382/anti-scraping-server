import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { CommonModule } from '../common/common.module';

/**
 * API Module
 * API 엔드포인트와 안티 스크래핑 기능을 제공
 * 핵심 기능에만 집중 (비즈니스 모듈들 제거됨)
 */
@Module({
  imports: [
    CommonModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
  exports: [ApiService],
})
export class ApiModule {}
