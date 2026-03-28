import { Module } from '@nestjs/common';

import { HoneypotController } from './honeypot.controller';

/**
 * Honeypot Feature Module
 *
 * 봇 탐지용 함정 엔드포인트 모듈.
 * SecurityEventService, ThreatScoreService는 CommonModule(@Global)에서 제공.
 */
@Module({
  controllers: [HoneypotController],
})
export class HoneypotModule {}
