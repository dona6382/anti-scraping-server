import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Headers,
  Ip,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';

// Services
import { 
  SecurityBusinessService,
  FingerprintValidationRequest
} from '../../services/security/security-business.service';

// Types
import { 
  FingerprintValidationResponse, 
  BrowserData 
} from '../../types';

// DTOs
import { BaseResponseDto } from '../../common/dto';

/**
 * Fingerprint Controller
 * 브라우저 핑거프린트 검증 및 봇 탐지 (비즈니스 로직 분리됨)
 */
@ApiTags('Security - Fingerprint')
@Controller('api/fingerprint')
export class FingerprintController {
  private readonly logger = new Logger(FingerprintController.name);

  constructor(private readonly securityBusinessService: SecurityBusinessService) {}

  /**
   * 핑거프린트 검증
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate browser fingerprint',
    description: `
    Validate browser fingerprint and detect bot behavior.
    
    **Process:**
    1. Generate secure fingerprint from browser data
    2. Perform bot detection analysis
    3. Assess security risk level
    4. Execute appropriate security measures
    5. Return validation result with recommendations
    
    **Security Measures:**
    - High-risk IPs may be temporarily blocked
    - Suspicious activity is logged and monitored
    - Challenges may be issued for verification
    `
  })
  @ApiBody({
    description: 'Browser fingerprint data collected from client',
    schema: {
      type: 'object',
      properties: {
        canvas: { type: 'string', description: 'Canvas fingerprint hash' },
        webgl: {
          type: 'object',
          properties: {
            vendor: { type: 'string' },
            renderer: { type: 'string' },
            version: { type: 'string' },
            extensions: { type: 'array', items: { type: 'string' } }
          }
        },
        audio: { type: 'string', description: 'Audio context fingerprint' },
        fonts: { type: 'array', items: { type: 'string' } },
        screen: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            colorDepth: { type: 'number' }
          }
        },
        timezone: { type: 'string' },
        language: { type: 'string' },
        platform: { type: 'string' }
      }
    }
  })
  @ApiHeader({
    name: 'x-fingerprint-id',
    description: 'Optional fingerprint ID from previous validation',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Fingerprint validation completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        fingerprintId: { type: 'string' },
        trustScore: { type: 'number', minimum: 0, maximum: 100 },
        botDetection: {
          type: 'object',
          properties: {
            isBot: { type: 'boolean' },
            score: { type: 'number', minimum: 0, maximum: 100 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            factors: { type: 'array', items: { type: 'string' } }
          }
        },
        recommendation: { 
          type: 'string',
          enum: ['ALLOW', 'MONITOR', 'CHALLENGE', 'BLOCK']
        },
        challenge: {
          type: 'object',
          nullable: true,
          properties: {
            type: { type: 'string' },
            difficulty: { type: 'number' },
            data: { type: 'object' }
          }
        }
      }
    }
  })
  async validateFingerprint(
    @Body() fingerprintData: BrowserData,
    @Headers('x-fingerprint-id') fingerprintId: string,
    @Ip() ip: string,
    @Req() request: Request,
  ): Promise<BaseResponseDto<FingerprintValidationResponse>> {
    this.logger.log(`Fingerprint validation requested from IP: ${ip}`);

    // 컨트롤러에서는 단순히 요청 데이터를 정리하고 서비스에 위임
    const validationRequest: FingerprintValidationRequest = {
      fingerprintData,
      fingerprintId,
      ip,
      userAgent: request.headers['user-agent'] || 'unknown'
    };

    const result = await this.securityBusinessService.validateFingerprint(validationRequest);
    
    const message = result.success 
      ? 'Fingerprint validation successful'
      : 'Fingerprint validation failed - suspicious activity detected';

    return new BaseResponseDto(result, message);
  }

  /**
   * 핑거프린트 상태 조회
   */
  @Get('status/:fingerprintId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get fingerprint status',
    description: 'Retrieve the current status and history of a specific fingerprint ID.'
  })
  @ApiParam({
    name: 'fingerprintId',
    description: 'Fingerprint ID to check status for',
    example: 'fp_abc123def456'
  })
  @ApiResponse({
    status: 200,
    description: 'Fingerprint status retrieved successfully'
  })
  async getFingerprintStatus(
    @Param('fingerprintId') fingerprintId: string,
    @Ip() ip: string,
  ): Promise<BaseResponseDto<{
    fingerprintId: string;
    status: string;
    trustScore: number;
    lastSeen: string;
    validationCount: number;
    riskFactors: string[];
  }>> {
    this.logger.log(`Fingerprint status requested: ${fingerprintId} from ${ip}`);

    // 실제 구현에서는 데이터베이스에서 조회
    // 여기서는 모의 데이터 반환
    const statusData = {
      fingerprintId,
      status: 'active',
      trustScore: 75,
      lastSeen: new Date().toISOString(),
      validationCount: 5,
      riskFactors: []
    };

    return new BaseResponseDto(
      statusData,
      `Status retrieved for fingerprint ${fingerprintId}`
    );
  }

  /**
   * 의심스러운 활동 신고
   */
  @Post('report-suspicious')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report suspicious activity',
    description: 'Report suspicious behavior detected on the client side for further analysis.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fingerprintId: { type: 'string', description: 'Associated fingerprint ID' },
        activityType: { 
          type: 'string',
          enum: ['automation_detected', 'unusual_timing', 'missing_events', 'suspicious_navigation'],
          description: 'Type of suspicious activity'
        },
        details: { 
          type: 'object',
          description: 'Additional details about the suspicious activity'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence level of the detection (0-1)'
        }
      },
      required: ['activityType']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Suspicious activity report received and processed'
  })
  async reportSuspiciousActivity(
    @Body() reportData: {
      fingerprintId?: string;
      activityType: string;
      details?: any;
      confidence?: number;
    },
    @Ip() ip: string,
  ): Promise<BaseResponseDto<{
    reportId: string;
    status: string;
    action: string;
  }>> {
    this.logger.warn(`Suspicious activity reported from IP ${ip}:`, reportData);

    // 비즈니스 서비스에 위임
    await this.securityBusinessService.monitorSuspiciousActivity(
      ip,
      reportData.activityType,
      {
        fingerprintId: reportData.fingerprintId,
        details: reportData.details,
        confidence: reportData.confidence || 0.5
      }
    );

    const response = {
      reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'received',
      action: 'monitoring_enhanced'
    };

    return new BaseResponseDto(
      response,
      'Suspicious activity report processed successfully'
    );
  }

  /**
   * 위협 분석 요청
   */
  @Post('analyze-threat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze potential threat',
    description: 'Analyze potential security threats based on provided indicators.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        indicators: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of threat indicators to analyze'
        },
        context: {
          type: 'object',
          description: 'Additional context for threat analysis'
        }
      },
      required: ['indicators']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Threat analysis completed'
  })
  async analyzeThreat(
    @Body() analysisData: {
      indicators: string[];
      context?: any;
    },
    @Ip() ip: string,
  ): Promise<BaseResponseDto<{
    riskScore: number;
    threats: string[];
    recommendations: string[];
  }>> {
    this.logger.log(`Threat analysis requested from IP ${ip}:`, analysisData.indicators);

    const analysis = await this.securityBusinessService.analyzeThreat(
      ip,
      analysisData.indicators
    );

    return new BaseResponseDto(
      analysis,
      `Threat analysis completed - Risk Score: ${analysis.riskScore}`
    );
  }

  /**
   * 보안 통계 조회
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get security statistics',
    description: 'Retrieve current security statistics and metrics.'
  })
  @ApiResponse({
    status: 200,
    description: 'Security statistics retrieved successfully'
  })
  async getSecurityStats(): Promise<BaseResponseDto<{
    totalValidations: number;
    botDetectionRate: number;
    averageTrustScore: number;
    topThreatFactors: string[];
    recentActivity: any[];
  }>> {
    this.logger.log('Security statistics requested');

    // 실제 구현에서는 데이터베이스에서 통계 조회
    const stats = {
      totalValidations: 15420,
      botDetectionRate: 12.5,
      averageTrustScore: 68.3,
      topThreatFactors: [
        'suspicious_user_agent',
        'automation_detected',
        'missing_browser_features'
      ],
      recentActivity: [
        {
          timestamp: new Date().toISOString(),
          type: 'bot_detected',
          count: 3
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: 'challenge_issued',
          count: 7
        }
      ]
    };

    return new BaseResponseDto(
      stats,
      'Security statistics retrieved successfully'
    );
  }
}
