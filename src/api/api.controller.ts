import { Controller, Get } from '@nestjs/common';
import { ApiService } from './api.service';
import { IpBlacklistService } from '../common/services/ip-blacklist.service';

@Controller('api')
export class ApiController {
  constructor(
    private readonly apiService: ApiService,
    private readonly ipBlacklistService: IpBlacklistService, // IpBlacklistService 주입
  ) {}

  @Get('data')
  getData() {
    return this.apiService.getProtectedData();
  }

  // 허니팟 엔드포인트: 봇이 접근하면 IP를 블랙리스트에 추가
  @Get('internal-config') // 봇이 좋아할 만한 이름으로 위장
  honeypot(@Req() request: Request) {
    const ip = request.ip;
    this.ipBlacklistService.add(ip);
    // 즉시 에러를 반환하여 봇의 추가적인 활동을 막음
    throw new ForbiddenException();
  }
}