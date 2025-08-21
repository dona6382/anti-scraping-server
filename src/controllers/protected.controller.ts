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

// Utils
import { ResponseBuilder, FormatResponse } from '../common/utils/response.builder';

// DTOs
import {
  BaseResponseDto,
  ContactRequestDto,
  ContactResponseDto,
} from '../common/dto';

/**
 * Protected API Controller
 * 중간 수준의 보안이 적용된 API 엔드포인트 (리팩토링됨)
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ 
    summary: 'Get protected data',
    description: 'Retrieve protected data with enhanced security measures.'
  })
  @ApiResponse({
    status: 200,
    description: 'Protected data retrieved successfully'
  })
  @ApiForbiddenResponse({ description: 'Access denied by security policy' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @FormatResponse('Protected data retrieved successfully')
  async getProtectedData() {
    this.logger.log('Protected data accessed successfully');
    return this.businessService.generateProtectedData();
  }

  /**
   * 연락처 폼 제출 (보호된)
   */
  @Post('contact')
  @UseGuards(HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Submit contact form',
    description: 'Submit a contact form with full anti-bot protection.'
  })
  @ApiBody({ type: ContactRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Contact form submitted successfully'
  })
  @ApiForbiddenResponse({ description: 'Security validation failed' })
  @ApiBadRequestResponse({ description: 'Invalid request data' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async submitContact(@Body() contactDto: ContactRequestDto) {
    this.logger.log('Contact form submitted', {
      email: contactDto.email,
      name: contactDto.name,
    });

    // 비즈니스 규칙 검증
    const validation = this.businessService.validateBusinessRules(contactDto as any);
    if (!validation.isValid) {
      this.logger.warn('Contact form validation failed', { errors: validation.errors });
      
      // validation.errors가 Record<string, string[]> 형식이 맞는지 확인
      const errors: Record<string, string[]> = {};
      if (validation.errors && typeof validation.errors === 'object') {
        // errors가 배열인 경우 처리
        if (Array.isArray(validation.errors)) {
          errors.general = validation.errors as string[];
        } else {
          // errors가 객체인 경우 처리
          for (const [key, value] of Object.entries(validation.errors)) {
            if (Array.isArray(value)) {
              errors[key] = value as string[];
            } else if (typeof value === 'string') {
              errors[key] = [value];
            } else {
              errors[key] = [String(value)];
            }
          }
        }
      }
      
      return ResponseBuilder.validationError(
        errors,
        'Contact form validation failed'
      );
    }

    const response = await this.businessService.processContactForm(contactDto);
    return ResponseBuilder.success(response, 'Contact form submitted successfully');
  }

  /**
   * 사용자 프로필 업데이트
   */
  @Post('profile/update')
  @UseGuards(HoneypotGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Update user profile information with protection.'
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
  ) {
    this.logger.log('Profile update requested', { 
      fields: Object.keys(updateData) 
    });

    const updatedFields = Object.keys(updateData).filter(
      key => updateData[key as keyof typeof updateData] !== undefined
    );
    
    const updateId = `UPDATE-${Date.now()}`;
    const result = {
      id: updateId,
      updatedFields,
      timestamp: new Date().toISOString(),
    };

    return ResponseBuilder.success(result, 'Profile updated successfully');
  }

  /**
   * 보호된 리소스 목록
   */
  @Get('resources')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 120000, limit: 15 } })
  @ApiOperation({ 
    summary: 'Get protected resources',
    description: 'Retrieve list of protected resources.'
  })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully'
  })
  @FormatResponse('Resources retrieved successfully')
  getProtectedResources() {
    this.logger.log('Protected resources requested');

    const resources = [
      {
        id: 'res-001',
        name: 'User Manual.pdf',
        type: 'document',
        size: 2048576,
        lastModified: new Date(Date.now() - 86400000).toISOString(),
        downloadUrl: '/api/protected/download/res-001'
      },
      {
        id: 'res-002', 
        name: 'API Documentation.pdf',
        type: 'document',
        size: 1536000,
        lastModified: new Date(Date.now() - 172800000).toISOString(),
        downloadUrl: '/api/protected/download/res-002'
      },
      {
        id: 'res-003',
        name: 'Sample Data.csv',
        type: 'data',
        size: 512000,
        lastModified: new Date().toISOString(),
        downloadUrl: '/api/protected/download/res-003'
      }
    ];

    return resources;
  }

  /**
   * 데이터 내보내기 요청
   */
  @Post('export')
  @UseGuards(HoneypotGuard)
  @Throttle({ default: { ttl: 900000, limit: 2 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ 
    summary: 'Request data export',
    description: 'Request export of user data.'
  })
  @ApiResponse({
    status: 202,
    description: 'Export request accepted'
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
    this.logger.log('Data export requested', { 
      format: exportRequest.format,
      includeMetadata: exportRequest.includeMetadata 
    });

    const exportId = `EXPORT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const result = {
      exportId,
      estimatedCompletionTime: new Date(Date.now() + 300000).toISOString(),
      downloadWillBeAvailableUntil: new Date(Date.now() + 2592000000).toISOString(),
    };

    return ResponseBuilder.success(result, 'Export request queued successfully');
  }
}
