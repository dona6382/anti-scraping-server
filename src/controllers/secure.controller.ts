import {
  Controller,
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

// Guards - 모든 보안 가드 적용
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// DTOs
import {
  BaseResponseDto,
  CriticalActionRequestDto,
  CriticalActionResponseDto,
} from '../common/dto';

/**
 * Secure API Controller
 * 최고 수준의 보안이 적용된 중요한 API 엔드포인트
 * 모든 보안 가드가 적용됩니다.
 */
@ApiTags('Secure APIs')
@Controller('api/secure')
@UseGuards(IpBlacklistGuard, UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
export class SecureController {
  private readonly logger = new Logger(SecureController.name);

  constructor(private readonly businessService: BusinessService) {}

  /**
   * 중요한 작업 실행
   */
  @Post('critical-action')
  @Throttle({ default: { ttl: 600000, limit: 3 } }) // 10분에 3회
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Perform critical action',
    description: `
    Execute critical system actions with maximum security protection.
    
    **Security Layers Applied:**
    - IP Blacklist Check
    - User-Agent Validation
    - Headless Browser Detection
    - Honeypot Field Validation
    - reCAPTCHA v3 Verification
    - Strict Rate Limiting (3 requests per 10 minutes)
    
    **Supported Actions:**
    - reset_password: Reset user password
    - delete_account: Permanently delete user account
    - export_data: Export all user data
    - change_email: Change primary email address
    - transfer_ownership: Transfer resource ownership
    `
  })
  @ApiBody({ type: CriticalActionRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Critical action completed successfully',
    type: BaseResponseDto<CriticalActionResponseDto>
  })
  @ApiForbiddenResponse({ 
    description: 'Security validation failed - request blocked by one or more security layers'
  })
  @ApiBadRequestResponse({ description: 'Invalid request data or unsupported action' })
  @ApiTooManyRequestsResponse({ 
    description: 'Rate limit exceeded - only 3 critical actions allowed per 10 minutes'
  })
  async performCriticalAction(
    @Body() actionDto: CriticalActionRequestDto
  ): Promise<BaseResponseDto<CriticalActionResponseDto>> {
    this.logger.warn('CRITICAL ACTION REQUESTED', {
      action: actionDto.action,
      timestamp: new Date().toISOString(),
    });

    // 추가 보안 검증
    const securityValidation = this.performAdditionalSecurityChecks(actionDto);
    if (!securityValidation.passed) {
      this.logger.error('Critical action failed additional security checks', {
        action: actionDto.action,
        reasons: securityValidation.reasons,
      });
      throw new Error('Additional security validation failed');
    }

    // 비즈니스 로직 처리
    const response = await this.businessService.processCriticalAction(actionDto);

    // 중요 작업 로그 기록
    this.logCriticalAction(actionDto, response);

    return new BaseResponseDto(response, 'Critical action completed successfully');
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * 추가 보안 검증 수행
   */
  private performAdditionalSecurityChecks(actionDto: CriticalActionRequestDto): {
    passed: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // 작업 유형별 추가 검증
    switch (actionDto.action) {
      case 'delete_account':
        // 계정 삭제는 특별한 확인이 필요
        if (!actionDto.parameters?.confirmationPhrase) {
          reasons.push('Missing confirmation phrase for account deletion');
        }
        break;
      
      case 'transfer_ownership':
        // 소유권 이전은 이메일 검증 필요
        if (!actionDto.parameters?.newOwnerEmail) {
          reasons.push('Missing new owner email for ownership transfer');
        }
        break;
      
      case 'export_data':
        // 대용량 데이터 내보내기 제한
        const exportSize = actionDto.parameters?.estimatedSize as number;
        if (exportSize && exportSize > 1073741824) { // 1GB
          reasons.push('Export size too large');
        }
        break;
    }

    // 시간 기반 제약 확인
    const currentHour = new Date().getHours();
    if (actionDto.action === 'delete_account' && (currentHour < 9 || currentHour > 17)) {
      reasons.push('Account deletion only allowed during business hours (9 AM - 5 PM)');
    }

    return {
      passed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * 중요 작업 로그 기록
   */
  private logCriticalAction(
    actionDto: CriticalActionRequestDto,
    response: CriticalActionResponseDto
  ): void {
    const auditLog = {
      action: actionDto.action,
      actionId: response.id,
      status: response.status,
      timestamp: response.timestamp,
      parameters: actionDto.parameters,
      userAgent: 'extracted-from-request', // 실제로는 요청에서 추출
      ipAddress: 'extracted-from-request', // 실제로는 요청에서 추출
    };

    // 실제로는 별도의 audit log 시스템에 저장
    this.logger.warn('CRITICAL_ACTION_AUDIT', auditLog);
  }
}
