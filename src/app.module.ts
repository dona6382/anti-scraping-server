import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiModule } from './api/api.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    // 1분에 20번으로 요청 제한
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20,
      // (선택) Redis Storage 사용
      // storage: new ThrottlerStorageRedisService({
      //   host: 'localhost',
      //   port: 6379,
      // }),
    }),
    ApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ThrottlerGuard를 전역 가드로 설정
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}