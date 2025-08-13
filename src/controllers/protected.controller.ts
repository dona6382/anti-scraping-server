import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { BusinessService } from '../services/business.service';

// Guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// DTOs
import {
  BaseResponseDto,
  ContactRequestDto,
  ContactResponseDto,
  CriticalActionRequestDto,
  CriticalActionResponseDto,
} from '../common/dto';

/**
 * Protected API Controller
 * 중간 수준의 보안이 적용된 API 엔드포인트
 */
@ApiTags('Protected APIs')
@Controller('api/protected')
@UseGuards(IpBlacklistGuard, UserAgentGuard, HeadlessBrowserGuard)
export class ProtectedController {
  private readonly logger = new Logger(ProtectedController.name);

  constructor(private readonly businessService: BusinessService) {}

  /**
   * 보호된 데이터 조회
   */
  @Get('data')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 1분에 10회
  @ApiOperation({ 
    summary: 'Get protected data',
    description: 'Retrieve protected data with enhanced security measures including User-Agent filtering and headless browser detection.'
  })
  @ApiResponse({
    status: 200,
    description: 'Protected data retrieved successfully',
    type: BaseResponseDto
  })
  @ApiForbiddenResponse({ description: 'Access denied by security policy' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  getProtectedData(): BaseResponseDto<{
    message: string;
    timestamp: string;
    sensitive: { secret: string; value: string };
  }> {
    this.logger.log('Protected data accessed successfully');

    const data = this.businessService.generateProtectedData();
    return new BaseResponseDto(data);
  }

  /**
   * 연락처 폼 제출 (보호된)
   */
  @Post('contact')
  @UseGuards(HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300000, limit: 5 } }) // 5분에 5회
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Submit contact form',
    description: 'Submit a contact form with full anti-bot protection including honeypot fields and reCAPTCHA verification.'
  })
  @ApiBody({ type: ContactRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Contact form submitted successfully',
    type: BaseResponseDto<ContactResponseDto>
  })
  @ApiForbiddenResponse({ description: 'Security validation failed' })
  @ApiBadRequestResponse({ description: 'Invalid request data' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async submitContact(
    @Body() contactDto: ContactRequestDto
  ): Promise<BaseResponseDto<ContactResponseDto>> {
    this.logger.log('Contact form submitted', {
      email: contactDto.email,
      name: contactDto.name,
    });

    // 비즈니스 규칙 검증
    const validation = this.businessService.validateBusinessRules(contactDto as any);
    if (!validation.isValid) {
      this.logger.warn('Contact form validation failed', { errors: validation.errors });
      // 실제로는 ValidationException을 던질 수 있음
    }

    const response = await this.businessService.processContactForm(contactDto);
    return new BaseResponseDto(response, 'Contact form submitted successfully');
  }

  /**
   * 사용자 프로필 업데이트
   */
  @Post('profile/update')
  @UseGuards(HoneypotGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 1분에 3회
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Update user profile information with protection against automated updates.'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully'
  })
  @ApiForbiddenResponse({ description: 'Security validation failed' })
  async updateProfile(
    @Body() updateData: {
      name?: string;
      email?: string;
      phone?: string;
      preferences?: Record<string, unknown>;
    }
  ): Promise<BaseResponseDto<{
    id: string;
    updatedFields: string[];
    timestamp: string;
  }>> {
    this.logger.log('Profile update requested', { 
      fields: Object.keys(updateData) 
    });

    // 비즈니스 로직: 프로필 업데이트
    const updatedFields = Object.keys(updateData).filter(key => updateData[key as keyof typeof updateData] !== undefined);
    const updateId = `UPDATE-${Date.now()}`;

    const result = {
      id: updateId,
      updatedFields,
      timestamp: new Date().toISOString(),
    };

    return new BaseResponseDto(result, 'Profile updated successfully');
  }

  /**
   * 보호된 리소스 목록
   */
  @Get('resources')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 120000, limit: 15 } }) // 2분에 15회
  @ApiOperation({ 
    summary: 'Get protected resources',
    description: 'Retrieve list of protected resources available to authenticated users.'
  })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully'
  })
  getProtectedResources(): BaseResponseDto<Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    lastModified: string;
    downloadUrl: string;
  }>> {
    this.logger.log('Protected resources requested');

    const resources = [
      {
        id: 'res-001',
        name: 'User Manual.pdf',
        type: 'document',
        size: 2048576, // 2MB in bytes
        lastModified: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        downloadUrl: '/api/protected/download/res-001'
      },
      {
        id: 'res-002', 
        name: 'API Documentation.pdf',
        type: 'document',
        size: 1536000, // 1.5MB
        lastModified: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        downloadUrl: '/api/protected/download/res-002'
      },
      {
        id: 'res-003',
        name: 'Sample Data.csv',
        type: 'data',
        size: 512000, // 500KB
        lastModified: new Date().toISOString(),
        downloadUrl: '/api/protected/download/res-003'
      }
    ];

    return new BaseResponseDto(resources);
  }

  /**
   * 데이터 내보내기 요청
   */
  @Post('export')
  @UseGuards(HoneypotGuard)
  @Throttle({ default: { ttl: 900000, limit: 2 } }) // 15분에 2회
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ 
    summary: 'Request data export',
    description: 'Request export of user data. The export will be processed asynchronously.'
  })
  @ApiResponse({
    status: 202,
    description: 'Export request accepted and queued for processing'
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
  ): Promise<BaseResponseDto<{
    exportId: string;
    estimatedCompletionTime: string;
    downloadWillBeAvailableUntil: string;
  }>> {
    this.logger.log('Data export requested', { 
      format: exportRequest.format,
      includeMetadata: exportRequest.includeMetadata 
    });

    const exportId = `EXPORT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const estimatedCompletionTime = new Date(Date.now() + 300000).toISOString(); // 5분 후
    const downloadWillBeAvailableUntil = new Date(Date.now() + 2592000000).toISOString(); // 30일 후

    const result = {
      exportId,
      estimatedCompletionTime,
      downloadWillBeAvailableUntil,
    };

    return new BaseResponseDto(result, 'Export request queued successfully');
  }
}
