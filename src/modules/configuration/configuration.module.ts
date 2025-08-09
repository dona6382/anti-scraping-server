import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';
import appConfig from '../../config/app.config';
import redisConfig from '../../config/redis.config';

/**
 * Configuration Module
 * 애플리케이션 설정을 중앙 관리
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, redisConfig],
      envFilePath: ['.env', '.env.local', `.env.${process.env.NODE_ENV}`],
    }),
  ],
  providers: [
    ConfigurationService,
    {
      provide: 'ConfigService', // Legacy support
      useExisting: ConfigurationService,
    },
  ],
  exports: [ConfigurationService, 'ConfigService', ConfigModule],
})
export class ConfigurationModule {}
