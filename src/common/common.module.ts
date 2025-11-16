import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Configuration은 CoreConfigModule에서 이미 글로벌로 제공됨
import { CoreConfigModule } from '../core/config/config.module';

// Cache는 core/cache 모듈에서 제공됨 (중복 제거)

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';
import { HttpService } from './services/http.service';
import { FingerprintService } from './services/fingerprint/fingerprint.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HoneypotGuard } from './guards/honeypot.guard';
import { RecaptchaGuard } from './guards/recaptcha.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

/**
 * Common Module
 * 공통 서비스, 가드를 제공하는 글로벌 모듈
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
    // Cache는 core/cache에서 제공 (중복 제거)
    
    // Services
    IpBlacklistService,
    HttpService,
    FingerprintService,
    
    // Guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
  ],
  exports: [
    // Cache는 core/cache에서 제공 (중복 제거)
    
    // Export services
    IpBlacklistService,
    HttpService,
    FingerprintService,
    
    // Export guards
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    
    // Export modules
    ThrottlerModule,
    CoreConfigModule,
  ],
})
export class CommonModule {}
