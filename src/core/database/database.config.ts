import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from '../config/config.service';

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
    
    // Entity auto-discovery
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    
    // Development settings
    synchronize: configService.isDevelopment && dbConfig.synchronize,
    logging: configService.isDevelopment ? 'all' : ['error'],
    
    // Connection pool settings
    extra: {
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
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
    ssl: configService.isProduction ? {
      rejectUnauthorized: false
    } : false,
  };
};
