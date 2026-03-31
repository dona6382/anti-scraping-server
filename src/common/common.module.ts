import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityEvent } from '../core/database/entities';

import { BehavioralGuard } from './guards/behavioral.guard';
import { ChallengeGuard } from './guards/challenge.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { TlsFingerprintGuard } from './guards/tls-fingerprint.guard';
import { UserAgentGuard } from './guards/user-agent.guard';
import { ChallengeService } from './services/challenge.service';
import { IpBlacklistService } from './services/ip-blacklist.service';
import { PuzzleCaptchaService } from './services/puzzle-captcha.service';
import { SecurityEventService } from './services/security-event.service';
import { ThreatScoreService } from './services/threat-score.service';

/**
 * Common Module
 * 보안 기능을 제공하는 글로벌 모듈
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent]),
    ThrottlerModule.forRootAsync({
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
    ThreatScoreService,
    ChallengeService,
    PuzzleCaptchaService,
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
    BehavioralGuard,
    TlsFingerprintGuard,
    ChallengeGuard,
  ],
  exports: [
    IpBlacklistService,
    SecurityEventService,
    ThreatScoreService,
    ChallengeService,
    PuzzleCaptchaService,
    UserAgentGuard,
    IpBlacklistGuard,
    HeadlessBrowserGuard,
    BehavioralGuard,
    TlsFingerprintGuard,
    ChallengeGuard,
    ThrottlerModule,
  ],
})
export class CommonModule {}
