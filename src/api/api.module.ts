import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { IpBlacklistService } from '../common/services/ip-blacklist.service';
import { IpBlacklistMiddleware } from '../common/middleware/ip-blacklist.middleware';

@Module({
  controllers: [ApiController],
  providers: [ApiService, IpBlacklistService], // IpBlacklistService를 providers에 추가
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpBlacklistMiddleware).forRoutes('api'); // /api 경로에 미들웨어 적용
  }
}