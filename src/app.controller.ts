import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiService } from './api.service';
import { Throttle } from '@nestjs/throttler';
import { UserAgentGuard } from './common/guards/user-agent.guard';

@Controller('api')
@UseGuards(UserAgentGuard)
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  // 이 엔드포인트는 전역 설정(1분/20회)을 따름
  @Get('data')
  getData() {
    return this.apiService.getProtectedData();
  }

  // 이 엔드포인트는 더 엄격한 규칙(1분/5회)을 적용
  @Throttle(5, 60)
  @Get('sensitive-data')
  getSensitiveData() {
    return { message: 'This is more sensitive data.' };
  }
}