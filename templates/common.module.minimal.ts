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

/**
 * Common Module - Minimal Configuration
 * 최소한의 보안 기능만 제공
 * 
 * 포함된 기능:
 * - UserAgentGuard: User-Agent 기반 봇 차단
 * - IpBlacklistGuard: IP 차단 시스템
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
  ],
  exports: [
    // Export services
    IpBlacklistService,
    
    // Export guards
    UserAgentGuard,
    IpBlacklistGuard,
    
    // Export modules
    ThrottlerModule,
    CoreConfigModule,
  ],
})
export class CommonModule {}
