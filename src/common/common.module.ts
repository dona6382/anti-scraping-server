import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreConfigModule } from '../core/config/config.module';
import { SecurityEvent } from '../core/database/entities';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';
import { SecurityEventService } from './services/security-event.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

/**
 * Common Module
 * 보안 기능을 제공하는 글로벌 모듈
 *
 * - Guards: UserAgent, IpBlacklist, HeadlessBrowser
 * - Services: IpBlacklist, SecurityEvent
 */
@Global()
@Module({
  imports: [
    CoreConfigModule,
    TypeOrmModule.forFeature([SecurityEvent]),
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
    IpBlacklistService,
    SecurityEventService,
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
  ],
  exports: [
    IpBlacklistService,
    SecurityEventService,
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
    ThrottlerModule,
    CoreConfigModule,
  ],
})
export class CommonModule {}
