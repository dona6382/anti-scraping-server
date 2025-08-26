import { Module } from '@nestjs/common';

// Controllers
import { SecurityAdminController } from './controllers/security-admin.controller';

// Services
import { IpBlacklistService } from './services/ip-blacklist.service';

// 임시로 memory cache 서비스 (나중에 Redis로 교체)
// import { MemoryCacheService } from './services/memory-cache.service';

/**
 * Security Feature Module
 * 
 * 보안 관련 모든 기능을 담당:
 * - IP 블랙리스트 관리
 * - 보안 통계
 * - 관리자 기능
 */
@Module({
  controllers: [
    SecurityAdminController,
  ],
  providers: [
    IpBlacklistService,
    // Cache service는 CoreModule에서 제공
    // {
    //   provide: 'ICacheService',
    //   useClass: MemoryCacheService, // 임시 메모리 캐시
    // },
  ],
  exports: [
    IpBlacklistService,
    // Cache service는 CoreModule에서 제공
    // 'ICacheService',
  ],
})
export class SecurityModule {}
