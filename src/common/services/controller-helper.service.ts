import { Injectable, Logger } from '@nestjs/common';
import { BusinessService } from '../../services/business.service';
import { ResponseBuilder } from '../utils/response.builder';
import { ValidationException } from '../exceptions';
import {
  ContactRequestDto,
  ContactResponseDto,
} from '../dto';

/**
 * Controller Helper Service
 * 여러 Controller에서 중복되는 비즈니스 로직을 통합 관리
 * 
 * 중복 제거 대상:
 * - 연락처 폼 처리 (3곳에서 사용)
 * - 데이터 내보내기 (2곳에서 사용)
 * - 프로필 업데이트 (2곳에서 사용)
 * - 보호된 데이터 조회 (3곳에서 사용)
 */
@Injectable()
export class ControllerHelperService {
  private readonly logger = new Logger(ControllerHelperService.name);

  constructor(private readonly businessService: BusinessService) {}

  /**
   * 연락처 폼 제출 처리 (통합)
   * ProtectedController, ImprovedProtectedController에서 중복
   */
  async handleContactForm(contactDto: ContactRequestDto): Promise<any> {
    this.logger.log('Contact form submission', {
      email: contactDto.email,
      name: contactDto.name,
    });

    // 비즈니스 규칙 검증
    const validation = this.businessService.validateBusinessRules(contactDto as any);
    
    if (!validation.isValid) {
      this.logger.warn('Contact form validation failed', { 
        errors: validation.errors 
      });
      
      // 에러 형식 정규화
      const normalizedErrors = this.normalizeValidationErrors(validation.errors);
      
      throw new ValidationException(
        'Validation failed',
        normalizedErrors
      );
    }

    // 성공 처리
    const response = await this.businessService.processContactForm(contactDto);
    
    return ResponseBuilder.success(
      response, 
      'Contact form submitted successfully'
    );
  }

  /**
   * 보호된 데이터 조회 (통합)
   * 여러 Controller에서 사용
   */
  async getProtectedData(context?: string): Promise<any> {
    this.logger.log(`Protected data accessed - context: ${context || 'general'}`);
    
    const data = await this.businessService.generateProtectedData();
    
    return ResponseBuilder.success(
      data,
      'Protected data retrieved successfully'
    );
  }

  /**
   * 데이터 내보내기 요청 처리 (통합)
   */
  async handleDataExport(exportRequest: {
    format: 'json' | 'csv' | 'xml';
    dateRange?: { from: string; to: string };
    includeMetadata?: boolean;
  }): Promise<any> {
    this.logger.log('Data export requested', { 
      format: exportRequest.format,
      includeMetadata: exportRequest.includeMetadata 
    });

    // 내보내기 ID 생성
    const exportId = this.generateExportId();
    
    // 예상 완료 시간 계산
    const estimatedTime = this.calculateEstimatedTime(exportRequest);
    
    const result = {
      exportId,
      format: exportRequest.format,
      estimatedCompletionTime: new Date(Date.now() + estimatedTime).toISOString(),
      downloadWillBeAvailableUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일
      status: 'queued',
    };

    return ResponseBuilder.success(
      result, 
      'Export request queued successfully'
    );
  }

  /**
   * 프로필 업데이트 처리 (통합)
   */
  async handleProfileUpdate(updateData: {
    name?: string;
    email?: string;
    phone?: string;
    preferences?: Record<string, unknown>;
  }): Promise<any> {
    this.logger.log('Profile update requested', { 
      fields: Object.keys(updateData) 
    });

    // 업데이트된 필드 추적
    const updatedFields = Object.keys(updateData).filter(
      key => updateData[key as keyof typeof updateData] !== undefined
    );
    
    if (updatedFields.length === 0) {
      throw new ValidationException(
        'No fields to update'
      );
    }

    const updateId = this.generateUpdateId();
    
    const result = {
      id: updateId,
      updatedFields,
      timestamp: new Date().toISOString(),
      success: true,
    };

    return ResponseBuilder.success(
      result, 
      'Profile updated successfully'
    );
  }

  /**
   * 보호된 리소스 목록 조회 (통합)
   */
  async getProtectedResources(filter?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    this.logger.log('Protected resources requested', filter);

    // 기본 리소스 목록 (실제로는 DB에서 조회)
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

    // 필터 적용
    let filteredResources = resources;
    if (filter?.type) {
      filteredResources = resources.filter(r => r.type === filter.type);
    }

    // 페이지네이션 적용
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 10;
    const paginatedResources = filteredResources.slice(offset, offset + limit);

    return ResponseBuilder.success(
      {
        resources: paginatedResources,
        total: filteredResources.length,
        offset,
        limit,
      },
      'Resources retrieved successfully'
    );
  }

  /**
   * 대량 작업 처리 (통합)
   */
  async handleBulkOperation(data: any): Promise<any> {
    this.logger.warn('Bulk operation requested', {
      dataSize: JSON.stringify(data).length,
      timestamp: new Date().toISOString(),
    });

    // 데이터 검증
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationException(
        'No data provided for bulk operation'
      );
    }

    // 비즈니스 로직 처리
    const result = await this.businessService.processBulkOperation(data);
    
    return ResponseBuilder.success(
      result, 
      'Bulk operation completed successfully'
    );
  }

  /**
   * 중요 작업 처리 (통합)
   */
  async handleCriticalAction(actionDto: any): Promise<any> {
    this.logger.error('CRITICAL ACTION REQUESTED', {
      action: actionDto.action,
      timestamp: new Date().toISOString(),
    });

    // 추가 보안 검증
    this.validateCriticalAction(actionDto);

    // 비즈니스 로직 처리
    const response = await this.businessService.processCriticalAction(actionDto);

    // 감사 로그
    this.auditCriticalAction(actionDto, response);

    return ResponseBuilder.success(
      response,
      'Critical action completed successfully'
    );
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Validation 에러 정규화
   */
  private normalizeValidationErrors(errors: any): Record<string, string[]> {
    const normalized: Record<string, string[]> = {};
    
    if (!errors || typeof errors !== 'object') {
      normalized.general = ['Validation failed'];
      return normalized;
    }

    if (Array.isArray(errors)) {
      normalized.general = errors.map(e => String(e));
    } else {
      for (const [key, value] of Object.entries(errors)) {
        if (Array.isArray(value)) {
          normalized[key] = value.map(v => String(v));
        } else if (typeof value === 'string') {
          normalized[key] = [value];
        } else {
          normalized[key] = [String(value)];
        }
      }
    }

    return normalized;
  }

  /**
   * Export ID 생성
   */
  private generateExportId(): string {
    return `EXPORT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  /**
   * Update ID 생성
   */
  private generateUpdateId(): string {
    return `UPDATE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  /**
   * 예상 완료 시간 계산
   */
  private calculateEstimatedTime(exportRequest: any): number {
    // 형식별 기본 시간
    const baseTime = {
      json: 60000,    // 1분
      csv: 120000,    // 2분
      xml: 180000,    // 3분
    };

    let time = baseTime[exportRequest.format as keyof typeof baseTime] || 60000;

    // 메타데이터 포함 시 추가 시간
    if (exportRequest.includeMetadata) {
      time += 30000; // 30초 추가
    }

    // 날짜 범위가 있으면 추가 시간
    if (exportRequest.dateRange) {
      time += 60000; // 1분 추가
    }

    return time;
  }

  /**
   * 중요 작업 검증
   */
  private validateCriticalAction(actionDto: any): void {
    const requiredFields = ['action', 'parameters'];
    const missingFields = requiredFields.filter(field => !actionDto[field]);
    
    if (missingFields.length > 0) {
      throw new ValidationException(
        `Required fields missing: ${missingFields.join(', ')}`
      );
    }

    // 작업별 특별 검증
    switch (actionDto.action) {
      case 'delete_account':
        if (!actionDto.parameters?.confirmationPhrase) {
          throw new ValidationException(
            'Confirmation phrase required for account deletion'
          );
        }
        break;
        
      case 'transfer_ownership':
        if (!actionDto.parameters?.newOwnerEmail) {
          throw new ValidationException(
            'New owner email required'
          );
        }
        break;
    }
  }

  /**
   * 중요 작업 감사 로그
   */
  private auditCriticalAction(actionDto: any, response: any): void {
    const auditLog = {
      action: actionDto.action,
      actionId: response.id,
      status: response.status,
      timestamp: new Date().toISOString(),
      parameters: this.sanitizeForAudit(actionDto.parameters),
    };

    // 실제로는 별도의 감사 로그 시스템에 저장
    this.logger.error('CRITICAL_ACTION_AUDIT', auditLog);
  }

  /**
   * 감사 로그용 데이터 정제
   */
  private sanitizeForAudit(data: any): any {
    if (!data) return {};
    
    const sanitized = { ...data };
    
    // 민감한 정보 마스킹
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}