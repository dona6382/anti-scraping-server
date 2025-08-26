import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseService } from './database.service';
import { createDatabaseConfig } from './database.config';
import { AppConfigService } from '../config/config.service';

/**
 * Core Database Module
 * 
 * TypeORM + PostgreSQL 통합
 * - 연결 관리
 * - 헬스체크
 * - 마이그레이션 지원
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: AppConfigService) => 
        createDatabaseConfig(configService),
      inject: [AppConfigService],
    }),
  ],
  providers: [
    DatabaseService,
  ],
  exports: [
    DatabaseService,
    TypeOrmModule,
  ],
})
export class CoreDatabaseModule {}
