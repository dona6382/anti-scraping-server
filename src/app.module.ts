import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Modules
import { ConfigModule } from './common/config.module';
import { CommonModule } from './common/common.module';
import { ApiModule } from './api/api.module';

// Controllers
import { AppController } from './app.controller';

// Services
import { AppService } from './app.service';

// Middleware
import { IpBlacklistMiddleware } from './common/middleware/ip-blacklist.middleware';

@Module({
  imports: [ConfigModule, CommonModule, ApiModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpBlacklistMiddleware).forRoutes('*');
  }
}
