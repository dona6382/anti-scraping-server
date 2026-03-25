import { Module, Global, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createDatabaseConfig } from './database.config';
import { AppConfigService } from '../config/config.service';

const logger = new Logger('CoreDatabaseModule');

/**
 * Core Database Module
 *
 * TypeORM + PostgreSQL 통합
 * DB 연결 실패 시에도 앱 부팅 가능 (degraded mode)
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: AppConfigService) => {
        const config = createDatabaseConfig(configService);

        if (!configService.isProduction) {
          const dbConfig = configService.databaseConfig;
          logger.log(`Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        }

        return config;
      },
      inject: [AppConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class CoreDatabaseModule {}
