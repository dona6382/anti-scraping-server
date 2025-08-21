import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { ControllerHelperService } from '../common/services/controller-helper.service';

// Guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// DTOs
import { ContactRequestDto } from '../common/dto';

/**
 * Unified Protected API Controller
 * 
 * 3개의 Controller를 통합:
 * - ProtectedController
 * - ImprovedProtectedController  
 * - SecureController의 일부
 * 
 * 중복 제거 결과:
 * - 기존: 약 500줄 (3개 파일 합계)
 * - 현재: 약 200줄 (60% 감소)
 * - 공통 로직은 ControllerHelperService로 이동
 */
@ApiTags('Protected APIs')
@Controller('api/protected')
@UseGuards(IpBlacklistGuard, UserAgentGuard) // 기본 보안
export class UnifiedProtectedController {
  private readonly logger = new Logger(UnifiedProtectedController.name);

  constructor(
    private readonly controllerHelper: ControllerHelperService
  ) {}

  // ==========================================
  // Basic Protected Endpoints
  // ==========================================

  /**
   * 보호된 데이터 조회
   */
  @Get('data')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ 
    summary: 'Get protected data',
    description: 'Retrieve protected data with basic security measures.'
  })
  @ApiResponse({
    status: 200,
    description: 'Protected data retrieved successfully'
  })
  async getProtectedData() {
    return this.controllerHelper.getProtectedData('basic');
  }

  /**
   * 향상된 보안이 적용된 데이터 조회
   */
  @Get('secure-data')
  @UseGuards(HeadlessBrowserGuard) // 추가 보안
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ 
    summary: 'Get highly secure data',
    description: 'Retrieve data with enhanced security measures.'
  })
  async getSecureData() {
    return this.controllerHelper.getProtectedData('secure');
  }

  // ==========================================
  // Form Submissions
  // ==========================================

  /**
   * 연락처 폼 제출
   */
  @Post('contact')
  @UseGuards(HoneypotGuard, RecaptchaGuard)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 300000, limit: 5 } })
  @ApiOperation({ 
    summary: 'Submit contact form',
    description: 'Submit a contact form with full anti-bot protection.'
  })
  @ApiBody({ type: ContactRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Contact form submitted successfully'
  })
  async submitContact(@Body() contactDto: ContactRequestDto) {
    return this.controllerHelper.handleContactForm(contactDto);
  }

  /**
   * 프로필 업데이트
   */
  @Post('profile/update')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Update user profile information with protection.'
  })
  async updateProfile(
    @Body() updateData: {
      name?: string;
      email?: string;
      phone?: string;
      preferences?: Record<string, unknown>;
    }
  ) {
    return this.controllerHelper.handleProfileUpdate(updateData);
  }

  // ==========================================
  // Resource Management
  // ==========================================

  /**
   * 보호된 리소스 목록 조회
   */
  @Get('resources')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 120000, limit: 15 } })
  @ApiOperation({ 
    summary: 'Get protected resources',
    description: 'Retrieve list of protected resources with pagination.'
  })
  @ApiQuery({ name: 'type', required: false, description: 'Resource type filter' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Page offset' })
  async getProtectedResources(
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filter: any = {};
    if (type !== undefined) filter.type = type;
    if (limit !== undefined) filter.limit = Number(limit);
    if (offset !== undefined) filter.offset = Number(offset);
    
    return this.controllerHelper.getProtectedResources(filter);
  }

  /**
   * 데이터 내보내기 요청
   */
  @Post('export')
  @UseGuards(HoneypotGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 900000, limit: 2 } })
  @ApiOperation({ 
    summary: 'Request data export',
    description: 'Request export of user data in various formats.'
  })
  async requestDataExport(
    @Body() exportRequest: {
      format: 'json' | 'csv' | 'xml';
      dateRange?: {
        from: string;
        to: string;
      };
      includeMetadata?: boolean;
    }
  ) {
    return this.controllerHelper.handleDataExport(exportRequest);
  }

  // ==========================================
  // High Security Operations
  // ==========================================

  /**
   * 대량 작업 (최대 보안)
   */
  @Post('bulk-operation')
  @UseGuards(HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900000, limit: 1 } }) // 15분에 1회
  @ApiOperation({ 
    summary: 'Perform bulk operation',
    description: 'Execute a bulk operation with maximum security.'
  })
  async performBulkOperation(@Body() data: any) {
    return this.controllerHelper.handleBulkOperation(data);
  }

  /**
   * 중요한 작업 실행
   */
  @Post('critical-action')
  @UseGuards(HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 600000, limit: 3 } }) // 10분에 3회
  @ApiOperation({ 
    summary: 'Perform critical action',
    description: 'Execute critical system actions with maximum security protection.'
  })
  async performCriticalAction(@Body() actionDto: any) {
    return this.controllerHelper.handleCriticalAction(actionDto);
  }

  // ==========================================
  // Health & Status
  // ==========================================

  /**
   * API 상태 확인
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Check API health',
    description: 'Simple health check endpoint.'
  })
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'protected-api',
    };
  }
}