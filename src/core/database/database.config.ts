import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { AppConfigService } from '../config/config.service';

import { User, SecurityEvent } from './entities';

/**
 * Database Configuration Factory
 */
export const createDatabaseConfig = (configService: AppConfigService): TypeOrmModuleOptions => {
  const dbConfig = configService.databaseConfig;

  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,

    // 사용 중인 엔티티만 명시적 등록
    entities: [User, SecurityEvent],

    // Development settings
    synchronize: configService.isDevelopment && dbConfig.synchronize,
    logging: configService.isDevelopment ? 'all' : ['error'],

    // Connection retry (dev에서는 빠르게 실패하고 계속 진행)
    retryAttempts: configService.isProduction ? 10 : 2,
    retryDelay: configService.isProduction ? 3000 : 1000,

    // PostgreSQL connection pool settings
    extra: {
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },

    // Migration settings
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsRun: false,
    migrationsTableName: 'migrations',

    // Performance settings
    cache: {
      duration: 30000, // 30 seconds
    },

    // SSL settings for production
    ssl: configService.isProduction
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  };
};
