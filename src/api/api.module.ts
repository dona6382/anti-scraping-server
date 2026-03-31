import { Module } from '@nestjs/common';

import { ApiV1Module } from './v1/v1.module';

/**
 * API Module
 *
 * 모든 API 버전을 관리하는 루트 API 모듈
 */
@Module({
  imports: [ApiV1Module],
})
export class ApiModule {}
