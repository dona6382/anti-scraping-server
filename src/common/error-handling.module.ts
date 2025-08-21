import { Module, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnhancedGlobalExceptionFilter } from './filters/enhanced-exception.filter';

/**
 * Error Handling Module
 * 중앙화된 에러 처리 모듈
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: APP_FILTER,
      useFactory: (configService: ConfigService) => {
        return new EnhancedGlobalExceptionFilter(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [],
})
export class ErrorHandlingModule {}
