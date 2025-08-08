import { Module, Global } from '@nestjs/common';
import { ConfigService } from './services/config.service';

/**
 * Configuration Module
 */
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
