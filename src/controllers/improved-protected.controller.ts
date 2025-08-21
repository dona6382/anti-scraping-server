import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { BusinessService } from '../services/business.service';

// Guards - 통합된 방식 사용
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';

// Decorators
import { Security, RateLimit, RequireRecaptcha, Public } from '../common/decorators/security.decorator';

// Interceptors
import { SecurityContextInterceptor, RequestMetricsInterceptor } from '../common/interceptors/security.interceptor';

// Utils
import { ResponseBuilder } from '../common/utils/response.builder';

// DTOs
import { ContactRequestDto } from '../common/dto';

/**
 * Improved Protected API Controller
 * 코드 중복을 제거한 개선된 버전
 */
@ApiTags('Protected APIs v2')
@Controller('api/v2/protected')
@UseInterceptors(SecurityContextInterceptor, RequestMetricsInterceptor)
@UseGuards(IpBlacklistGuard, UserAgentGuard) // 기본 보안
export class ImprovedProtectedController {
  private readonly logger = new Logger(ImprovedProtectedController.name);

  constructor(private readonly businessService: BusinessService) {}

  /**
   * 보호된 데이터 조회 (개선된 버전)
   */
  @Get('data')
  @HttpCode(HttpStatus.OK)
  @RateLimit(60000, 10) // 데코레이터로 간단하게
  @Security({
    skipGuards: [], // 기본 가드만 사용
  })
  @ApiOperation({ 
    summary: 'Get protected data',
    description: 'Retrieve protected data with basic security measures.'
  })
  async getProtectedData() {
    this.logger.log('Protected data accessed');
    return ResponseBuilder.success(
      await this.businessService.generateProtectedData(),
      'Protected data retrieved successfully'
    );
  }

  /**
   * 향상된 보안 데이터 조회
   */
  @Get('secure-data')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HeadlessBrowserGuard) // 추가 가드
  @RateLimit(60000, 5)
  @ApiOperation({ 
    summary: 'Get highly secure data',
    description: 'Retrieve data with enhanced security measures.'
  })
  async getSecureData() {
    this.logger.log('Secure data accessed');
    return ResponseBuilder.success(
      await this.businessService.generateProtectedData(),
      'Secure data retrieved successfully'
    );
  }

  /**
   * 연락처 폼 제출 (개선된 버전)
   */
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(HoneypotGuard, RecaptchaGuard)
  @RateLimit(300000, 5)
  @RequireRecaptcha(0.5)
  @Security({
    honeypot: {
      fieldName: 'email_confirm',
      timeThreshold: 2000,
    },
  })
  @ApiOperation({ 
    summary: 'Submit contact form',
    description: 'Submit a contact form with full anti-bot protection.'
  })
  @ApiBody({ type: ContactRequestDto })
  async submitContact(@Body() contactDto: ContactRequestDto) {
    this.logger.log('Contact form submitted', {
      email: contactDto.email,
      name: contactDto.name,
    });

    try {
      const response = await this.businessService.processContactForm(contactDto);
      return ResponseBuilder.success(response, 'Contact form submitted successfully');
    } catch (error) {
      this.logger.error('Contact form processing failed', error);
      return ResponseBuilder.error('Failed to process contact form');
    }
  }

  /**
   * 대량 작업 (최대 보안)
   */
  @Post('bulk-operation')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @RateLimit(900000, 1) // 15분에 1회
  @RequireRecaptcha(0.7) // 높은 점수 요구
  @Security({
    recaptcha: { required: true, scoreThreshold: 0.7 },
    honeypot: { fieldName: 'trap_field' },
  })
  @ApiOperation({ 
    summary: 'Perform bulk operation',
    description: 'Execute a bulk operation with maximum security.'
  })
  async performBulkOperation(@Body() data: any) {
    this.logger.warn('Bulk operation requested');
    
    // 비즈니스 로직
    const result = await this.businessService.processBulkOperation(data);
    
    return ResponseBuilder.success(result, 'Bulk operation completed');
  }

  /**
   * 공개 엔드포인트 (보안 검사 제외)
   */
  @Get('public-info')
  @Public() // 모든 가드 스킵
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get public information',
    description: 'Retrieve public information without security checks.'
  })
  async getPublicInfo() {
    return ResponseBuilder.success(
      { info: 'This is public information' },
      'Public info retrieved'
    );
  }
}
