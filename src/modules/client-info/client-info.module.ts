import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientInfoController } from './client-info.controller';
import { ClientInfoService } from './client-info.service';

/**
 * Client Information Module
 * 클라이언트 정보 수집 및 분석 모듈
 */
@Module({
  imports: [ConfigModule],
  controllers: [ClientInfoController],
  providers: [ClientInfoService],
  exports: [ClientInfoService],
})
export class ClientInfoModule {}
