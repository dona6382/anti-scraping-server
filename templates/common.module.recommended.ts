import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Configuration은 CoreConfigModule에서 이미 글로벌로 제공됨
import { CoreConfigModule } from '../core/config/config.module';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

/**
 * Common Module - Recommended Configuration
 * 권장 보안 기능 제공
 * 
 * 포함된 기능:
 * - UserAgentGuard: User-Agent 기반 봇 차단
 * - IpBlacklistGuard: IP 차단 시스템
 * - HeadlessBrowserGuard: 헤드리스 브라우저 탐지
 */
@Global()
@Module({
  imports: [
    CoreConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [CoreConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_TTL', 10) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 20),
          },
        ],
      }),
    }),
  ],
  providers: [
    // Services
    IpBlacklistService,
    
    // Guards
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
  ],
  exports: [
    // Export services
    IpBlacklistService,
    
    // Export guards
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
    
    // Export modules
    ThrottlerModule,
    CoreConfigModule,
  ],
})
export class CommonModule {}
