import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';

/**
 * API Module
 * 비즈니스 로직 API 엔드포인트를 관리하는 모듈
 */
@Module({
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
