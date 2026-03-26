import { Module } from '@nestjs/common';
import { ChallengeController } from './challenge.controller';

/**
 * Challenge Module
 * JS Challenge + Browser Fingerprint 검증 엔드포인트 모듈
 */
@Module({
  controllers: [ChallengeController],
})
export class ChallengeModule {}
