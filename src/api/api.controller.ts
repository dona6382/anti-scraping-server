import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

// Services
import { ApiService } from './api.service';

// Guards - 필요에 따라 선택적으로 적용
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';

/**
 * API Controller
 * 안티 스크래핑 기능을 테스트하는 API 엔드포인트
 * 각 엔드포인트마다 필요한 보호 수준을 다르게 적용
 */
@Controller('api/v1')
@UseGuards(IpBlacklistGuard) // 모든 API 엔드포인트에 IP 블랙리스트 적용
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(private readonly apiService: ApiService) {}

  // ============================================
  // 공개 API (낮은 보호 수준)
  // ============================================

  /**
   * 샘플 사용자 데이터 조회 (테스트용)
   */
  @Get('sample/user')
  @UseGuards(UserAgentGuard)
  @Throttle({ default: { ttl: 60, limit: 50 } })
  async getSampleUserData() {
    this.logger.log('Sample user data requested');
    return this.apiService.getSampleUserData();
  }

  /**
   * API 상태 확인
   */
  @Get('status')
  @UseGuards(UserAgentGuard)
  @Throttle({ default: { ttl: 60, limit: 30 } })
  async getApiStatus() {
    this.logger.log('API status requested');
    return this.apiService.getApiStatus();
  }

  // ============================================
  // 보호된 API (중간 보호 수준)
  // ============================================

  /**
   * 보호된 데이터 조회
   */
  @Get('protected/data')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 10 } })
  async getProtectedData() {
    this.logger.log('Protected data requested');
    
    return {
      status: 'success',
      message: 'Protected data accessed successfully',
      data: {
        secret: 'This is protected by anti-scraping measures',
        timestamp: new Date().toISOString(),
        level: 'medium-protection'
      }
    };
  }

  /**
   * 폼 제출 테스트 (Honeypot + reCAPTCHA)
   */
  @Post('contact')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300, limit: 5 } })
  async submitContact(@Body() contactData: any) {
    this.logger.log('Contact form submission', {
      name: contactData.name,
      email: contactData.email
    });

    // Honeypot과 reCAPTCHA 필드 제거
    const cleanedData = { ...contactData };
    delete cleanedData.email_confirm;
    delete cleanedData.recaptchaToken;
    delete cleanedData._timestamp;
    delete cleanedData._jsToken;
    delete cleanedData._browserProps;

    return {
      status: 'success',
      message: 'Contact form submitted successfully',
      data: cleanedData,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================
  // 높은 보호 수준 API
  // ============================================

  /**
   * 중요한 액션 (최대 보호)
   */
  @Post('critical/action')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 600, limit: 3 } })
  async performCriticalAction(@Body() actionData: any) {
    this.logger.warn('Critical action requested', {
      action: actionData.action,
      userId: actionData.userId
    });

    // 민감한 필드 제거
    const cleanedData = { ...actionData };
    delete cleanedData.email_confirm;
    delete cleanedData.recaptchaToken;
    delete cleanedData._timestamp;
    delete cleanedData._jsToken;
    delete cleanedData._browserProps;

    return {
      status: 'success',
      message: 'Critical action completed',
      actionId: `ACTION_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================
  // 데이터 분석 API (봇 차단 중요)
  // ============================================

  /**
   * 검색 API (스크래핑 대상)
   */
  @Get('search')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 20 } })
  async searchData(@Query('q') query: string, @Query('page') page: number = 1) {
    this.logger.log(`Search requested: ${query}, page: ${page}`);

    if (!query) {
      return {
        status: 'error',
        message: 'Query parameter is required',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'success',
      query,
      page,
      results: [
        { id: 1, title: `Result 1 for "${query}"`, score: 0.95 },
        { id: 2, title: `Result 2 for "${query}"`, score: 0.87 },
        { id: 3, title: `Result 3 for "${query}"`, score: 0.76 }
      ],
      total: 150,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 민감한 데이터 조회 (최고 보호)
   */
  @Get('sensitive/data')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300, limit: 5 } })
  async getSensitiveData(@Query('type') dataType?: string) {
    this.logger.warn(`Sensitive data requested: ${dataType}`);

    return {
      status: 'success',
      message: 'Sensitive data access granted',
      dataType: dataType || 'default',
      data: {
        secret: 'Highly protected information',
        level: 'maximum-protection',
        accessTime: new Date().toISOString()
      }
    };
  }
}
