import { Module } from '@nestjs/common';

// Feature modules
import { AuthModule } from '../../features/auth/auth.module';
import { SecurityModule } from '../../features/security/security.module';
import { HealthModule } from '../../features/health/health.module';
import { ClientInfoModule } from '../../features/client-info/client-info.module';
import { PublicModule } from '../../features/public/public.module';
import { AdminModule } from '../../features/admin/admin.module';
import { TestingModule } from '../../features/testing/testing.module';
import { AnalysisModule } from '../../features/analysis/analysis.module';
import { RealtimeModule } from '../../features/realtime/realtime.module';
import { ChallengeModule } from '../../features/challenge/challenge.module';
import { HoneypotModule } from '../../features/honeypot/honeypot.module';
import { ScoreboardModule } from '../../features/scoreboard/scoreboard.module';

const coreModules = [
  AuthModule,
  SecurityModule,
  HealthModule,
  ClientInfoModule,
  PublicModule,
  AdminModule,
  AnalysisModule,
  RealtimeModule,
  ChallengeModule,
  HoneypotModule,
  ScoreboardModule,
];

// TestingModule은 프로덕션에서 비활성화 (내부 정보 노출 방지)
const devModules =
  process.env.NODE_ENV !== 'production' ? [TestingModule] : [];

/**
 * API v1 Module
 *
 * v1 버전의 모든 API 엔드포인트를 관리
 */
@Module({
  imports: [...coreModules, ...devModules],
})
export class ApiV1Module {}
