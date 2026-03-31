import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ClientInfoController } from './client-info.controller';
import { ClientInfoService } from './client-info.service';

/**
 * Client Info Feature Module
 *
 * 클라이언트 정보 수집 및 분석 기능:
 * - IP 정보
 * - 브라우저/OS 정보
 * - 프록시 탐지
 * - 보안 분석
 */
@Module({
  imports: [AuthModule],
  controllers: [ClientInfoController],
  providers: [ClientInfoService],
  exports: [ClientInfoService],
})
export class ClientInfoModule {}
