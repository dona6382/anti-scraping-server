import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';
import { BlacklistEntry, SecurityReason, IpStatistics } from '../../types';

/**
 * Pagination Parameters Interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: 'ip' | 'blockedAt' | 'count' | 'reason';
  order: 'asc' | 'desc';
}

/**
 * Blacklist Request Interface
 */
export interface BlacklistRequest {
  ip: string;
  reason?: string;
  ttl?: number;
}

/**
 * Paginated Response Interface
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Admin Business Service
 * 관리자 기능의 비즈니스 로직을 처리하는 서비스
 */
@Injectable()
export class AdminBusinessService {
  private readonly logger = new Logger(AdminBusinessService.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * IP 블랙리스트 통계 조회
   */
  async getBlacklistStatistics(): Promise<IpStatistics> {
    this.logger.log('Retrieving blacklist statistics');
    
    try {
      const stats = await this.ipBlacklistService.getStatistics();
      
      this.logger.log(`Statistics retrieved: ${stats.totalBlocked} total blocked IPs`);
      return stats;
    } catch (error) {
      this.logger.error('Failed to retrieve blacklist statistics', error);
      throw new BadRequestException('Failed to retrieve statistics');
    }
  }

  /**
   * 페이지네이션된 블랙리스트 IP 조회
   */
  async getPaginatedBlacklistedIps(params: PaginationParams): Promise<PaginatedResponse<BlacklistEntry>> {
    this.logger.log('Retrieving paginated blacklisted IPs', { params });

    try {
      // 입력 유효성 검사
      const validatedParams = this.validatePaginationParams(params);
      
      // 모든 블랙리스트 항목 조회 (상세 정보 포함)
      const allEntries = await this.ipBlacklistService.getBlocklist();
      
      // 비즈니스 로직: 정렬 및 페이지네이션
      const result = this.processPaginatedData(allEntries, validatedParams);
      
      this.logger.log(`Retrieved ${result.items.length} of ${result.pagination.total} blacklisted IPs`);
      return result;
    } catch (error) {
      this.logger.error('Failed to retrieve blacklisted IPs', error);
      throw new BadRequestException('Failed to retrieve blacklisted IPs');
    }
  }

  /**
   * IP를 블랙리스트에 추가
   */
  async addIpToBlacklist(request: BlacklistRequest): Promise<{ ip: string; reason: string; ttl?: number }> {
    this.logger.warn('Adding IP to blacklist', { 
      ip: request.ip,
      reason: request.reason 
    });

    try {
      // 비즈니스 로직: IP 유효성 검사
      this.validateIpAddress(request.ip);
      
      // 이미 블랙리스트에 있는지 확인
      const isAlreadyBlocked = await this.ipBlacklistService.isBlocked(request.ip);
      if (isAlreadyBlocked) {
        this.logger.warn(`IP ${request.ip} is already blacklisted`);
        throw new BadRequestException(`IP ${request.ip} is already blacklisted`);
      }

      // 블랙리스트에 추가
      const reason = (request.reason as SecurityReason) || 'MANUAL_ADMIN_ACTION';
      await this.ipBlacklistService.blacklistIp(request.ip, reason, request.ttl);

      const result: { ip: string; reason: string; ttl?: number } = {
        ip: request.ip,
        reason: request.reason || 'MANUAL_ADMIN_ACTION',
      };
      
      if (request.ttl !== undefined) {
        result.ttl = request.ttl;
      }

      this.logger.log(`IP ${request.ip} successfully added to blacklist`);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to add IP to blacklist', error);
      throw new BadRequestException('Failed to add IP to blacklist');
    }
  }

  /**
   * IP를 블랙리스트에서 제거
   */
  async removeIpFromBlacklist(ip: string): Promise<{ ip: string; status: string }> {
    this.logger.log('Removing IP from blacklist', { ip });

    try {
      // 비즈니스 로직: IP 유효성 검사
      this.validateIpAddress(ip);
      
      // 블랙리스트에 있는지 확인
      const isBlocked = await this.ipBlacklistService.isBlocked(ip);
      if (!isBlocked) {
        throw new NotFoundException(`IP ${ip} is not in blacklist`);
      }

      // 블랙리스트에서 제거
      await this.ipBlacklistService.unblockIp(ip);

      this.logger.log(`IP ${ip} successfully removed from blacklist`);
      return {
        ip,
        status: 'removed'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to remove IP from blacklist', error);
      throw new BadRequestException('Failed to remove IP from blacklist');
    }
  }

  /**
   * 특정 IP의 블랙리스트 정보 조회
   */
  async getBlacklistInfo(ip: string): Promise<BlacklistEntry | null> {
    this.logger.log('Getting blacklist info for IP', { ip });

    try {
      // 비즈니스 로직: IP 유효성 검사
      this.validateIpAddress(ip);
      
      const info = await this.ipBlacklistService.getBlockInfo(ip);
      
      if (!info) {
        this.logger.log(`IP ${ip} is not in blacklist`);
        return null;
      }

      this.logger.log(`Retrieved blacklist info for IP ${ip}`);
      return info;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to get blacklist info', error);
      throw new BadRequestException('Failed to get blacklist info');
    }
  }

  /**
   * 블랙리스트 정리 (만료된 항목 제거)
   */
  async cleanupExpiredEntries(): Promise<{ removedCount: number }> {
    this.logger.log('Cleaning up expired blacklist entries');

    try {
      // 비즈니스 로직: 만료된 항목 식별 및 제거
      const allEntries = await this.ipBlacklistService.getBlocklist();
      const now = new Date();
      let removedCount = 0;

      for (const entry of allEntries) {
        if (entry.expiresAt && entry.expiresAt < now) {
          await this.ipBlacklistService.unblockIp(entry.ip);
          removedCount++;
        }
      }

      this.logger.log(`Cleanup completed: ${removedCount} expired entries removed`);
      return { removedCount };
    } catch (error) {
      this.logger.error('Failed to cleanup expired entries', error);
      throw new BadRequestException('Failed to cleanup expired entries');
    }
  }

  // ============================================
  // Private Helper Methods (비즈니스 로직)
  // ============================================

  /**
   * 페이지네이션 파라미터 유효성 검사
   */
  private validatePaginationParams(params: PaginationParams): PaginationParams {
    return {
      page: Math.max(1, params.page),
      limit: Math.min(Math.max(1, params.limit), 100), // 최대 100개로 제한
      sortBy: params.sortBy || 'blockedAt',
      order: params.order || 'desc'
    };
  }

  /**
   * 페이지네이션된 데이터 처리
   */
  private processPaginatedData(
    data: BlacklistEntry[], 
    params: PaginationParams
  ): PaginatedResponse<BlacklistEntry> {
    // 정렬
    const sortedData = this.sortBlacklistEntries(data, params.sortBy, params.order);

    // 페이지네이션
    const startIndex = (params.page - 1) * params.limit;
    const endIndex = startIndex + params.limit;
    const paginatedData = sortedData.slice(startIndex, endIndex);

    return {
      items: paginatedData,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: data.length,
        totalPages: Math.ceil(data.length / params.limit),
      },
    };
  }

  /**
   * 블랙리스트 항목 정렬
   */
  private sortBlacklistEntries(
    entries: BlacklistEntry[],
    sortBy: string,
    order: string
  ): BlacklistEntry[] {
    return entries.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'ip':
          comparison = a.ip.localeCompare(b.ip);
          break;
        case 'blockedAt':
          comparison = new Date(a.blockedAt).getTime() - new Date(b.blockedAt).getTime();
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'reason':
          comparison = a.reason.localeCompare(b.reason);
          break;
        default:
          comparison = new Date(a.blockedAt).getTime() - new Date(b.blockedAt).getTime();
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * IP 주소 유효성 검사
   */
  private validateIpAddress(ip: string): void {
    if (!ip || typeof ip !== 'string') {
      throw new BadRequestException('IP address is required');
    }

    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new BadRequestException('Invalid IP address format');
    }
  }
}
