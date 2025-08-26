import { Module } from '@nestjs/common';

// Feature modules
import { SecurityModule } from '../../features/security/security.module';
import { HealthModule } from '../../features/health/health.module';
import { ClientInfoModule } from '../../features/client-info/client-info.module';
import { PublicModule } from '../../features/public/public.module';
import { AdminModule } from '../../features/admin/admin.module';
import { TestingModule } from '../../features/testing/testing.module';
import { AuthModule } from '../../features/auth/auth.module';

/**
 * API v1 Module
 * 
 * v1 버전의 모든 API 엔드포인트를 관리:
 * - /api/v1/security/*
 * - /api/v1/health/*
 * - /api/v1/client/*
 */
@Module({
  imports: [
    SecurityModule,
    HealthModule,
    ClientInfoModule,
    PublicModule,
    AdminModule,
    TestingModule,
    AuthModule,
  ],
})
export class ApiV1Module {}
