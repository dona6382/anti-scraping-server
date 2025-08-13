import { Module, Global } from '@nestjs/common';

// Controllers
import { SecurityAdminController } from './security-admin.controller';
import { FingerprintController } from './fingerprint.controller';

// Common services that are already available
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';

/**
 * Security Module
 * 보안 관련 관리 기능을 제공하는 모듈
 * 실제 보안 가드들은 Common 모듈에서 제공됨
 */
@Global()
@Module({
  controllers: [
    SecurityAdminController,
    FingerprintController,
  ],
  providers: [
    // Security Admin에서 사용할 서비스들은 Common에서 inject
  ],
  exports: [],
})
export class SecurityModule {}
