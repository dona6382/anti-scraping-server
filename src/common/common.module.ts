import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config.module';

// Config
import { ConfigService } from './services/config.service';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';
import { HttpService } from './services/http.service';
import { HealthService } from './services/health.service';

// Guards
import { UserAgentGuard } from './guards/user-agent.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { HoneypotGuard } from './guards/honeypot.guard';
import { RecaptchaGuard } from './guards/recaptcha.guard';
import { HeadlessBrowserGuard } from './guards/headless-browser.guard';

// Middleware
import { IpBlacklistMiddleware } from './middleware/ip-blacklist.middleware';

@Global()
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('app.throttle.ttl', 10) * 1000,
            limit: config.get('app.throttle.limit', 20),
          },
        ],
      }),
    }),
  ],
  providers: [
    IpBlacklistService,
    HttpService,
    HealthService,
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    IpBlacklistMiddleware,
  ],
  exports: [
    IpBlacklistService,
    HttpService,
    HealthService,
    UserAgentGuard,
    IpBlacklistGuard,
    HoneypotGuard,
    RecaptchaGuard,
    HeadlessBrowserGuard,
    IpBlacklistMiddleware,
    ThrottlerModule,
  ],
})
export class CommonModule {}
