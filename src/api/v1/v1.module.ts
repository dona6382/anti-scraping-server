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

/**
 * API v1 Module
 *
 * v1 버전의 모든 API 엔드포인트를 관리
 */
@Module({
  imports: [
    AuthModule,
    SecurityModule,
    HealthModule,
    ClientInfoModule,
    PublicModule,
    AdminModule,
    TestingModule,
    AnalysisModule,
  ],
})
export class ApiV1Module {}
