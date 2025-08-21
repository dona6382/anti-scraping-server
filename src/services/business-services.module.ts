import { Module } from '@nestjs/common';

// Import business services
import { AdminBusinessService } from './admin/admin-business.service';
import { SecurityBusinessService } from './security/security-business.service';
import { TestingBusinessService } from './testing/testing-business.service';

// Import dependencies
import { IpBlacklistService } from '../common/services/ip-blacklist.service';
import { FingerprintService } from '../common/services/fingerprint/fingerprint.service';

/**
 * Business Services Module
 * 모든 비즈니스 로직 서비스들을 중앙 관리하는 모듈
 */
@Module({
  providers: [
    // Business Services
    AdminBusinessService,
    SecurityBusinessService,
    TestingBusinessService,
    
    // Dependencies (Common Services)
    IpBlacklistService,
    FingerprintService,
  ],
  exports: [
    // Export business services for use in controllers
    AdminBusinessService,
    SecurityBusinessService,
    TestingBusinessService,
  ],
})
export class BusinessServicesModule {}
