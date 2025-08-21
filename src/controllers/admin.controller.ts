import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

// Services
import { 
  AdminBusinessService, 
  PaginationParams, 
  BlacklistRequest 
} from '../services';

// DTOs
import {
  BaseResponseDto,
  BlacklistIpRequestDto,
} from '../common/dto';
import { IpStatistics, BlacklistEntry } from '../types';

/**
 * Admin Controller
 * 관리자 전용 기능을 제공하는 컨트롤러 (비즈니스 로직 분리됨)
 */
@ApiTags('Admin')
@Controller('admin')
@SkipThrottle() // 관리자는 rate limiting 제외
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminBusinessService: AdminBusinessService) {}

  // ============================================
  // IP 블랙리스트 관리
  // ============================================

  /**
   * IP 블랙리스트 통계 조회
   */
  @Get('blacklist/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get IP blacklist statistics',
    description: 'Retrieve comprehensive statistics about the IP blacklist including total blocked IPs, recent activity, and top blocking reasons.'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: BaseResponseDto<IpStatistics>
  })
  async getBlacklistStats(): Promise<BaseResponseDto<IpStatistics>> {
    this.logger.log('Admin: Blacklist statistics requested');

    const stats = await this.adminBusinessService.getBlacklistStatistics();
    return new BaseResponseDto(stats);
  }

  /**
   * 모든 차단된 IP 조회 (페이지네이션)
   */
  @Get('blacklist/ips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get all blacklisted IPs',
    description: 'Retrieve a paginated list of all blacklisted IP addresses with their blocking information.'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (max 100)',
    example: 20
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['ip', 'blockedAt', 'count', 'reason'],
    description: 'Sort field',
    example: 'blockedAt'
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order',
    example: 'desc'
  })
  @ApiResponse({
    status: 200,
    description: 'Blacklisted IPs retrieved successfully'
  })
  async getBlacklistedIps(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: 'ip' | 'blockedAt' | 'count' | 'reason' = 'blockedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc'
  ): Promise<BaseResponseDto<{
    ips: BlacklistEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    this.logger.log('Admin: Blacklisted IPs requested', { page, limit, sortBy, order });

    const paginationParams: PaginationParams = {
      page,
      limit,
      sortBy,
      order
    };

    const result = await this.adminBusinessService.getPaginatedBlacklistedIps(paginationParams);
    
    return new BaseResponseDto({
      ips: result.items,
      pagination: result.pagination
    });
  }

  /**
   * IP를 블랙리스트에 추가
   */
  @Post('blacklist/ip')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Add IP to blacklist',
    description: 'Manually add an IP address to the blacklist with optional reason and TTL.'
  })
  @ApiBody({ type: BlacklistIpRequestDto })
  @ApiResponse({
    status: 201,
    description: 'IP blacklisted successfully'
  })
  @ApiForbiddenResponse({
    description: 'IP already blacklisted or invalid IP format'
  })
  async addIpToBlacklist(
    @Body() blacklistDto: BlacklistIpRequestDto
  ): Promise<BaseResponseDto<{ ip: string; reason: string; ttl?: number }>> {
    this.logger.log('Admin: Adding IP to blacklist', { 
      ip: blacklistDto.ip,
      reason: blacklistDto.reason 
    });

    const blacklistRequest: BlacklistRequest = {
      ip: blacklistDto.ip,
      ...(blacklistDto.reason && { reason: blacklistDto.reason }),
      ...(blacklistDto.ttl && { ttl: blacklistDto.ttl })
    };

    const result = await this.adminBusinessService.addIpToBlacklist(blacklistRequest);
    return new BaseResponseDto(result, `IP ${blacklistDto.ip} has been blacklisted`);
  }

  /**
   * IP를 블랙리스트에서 제거
   */
  @Delete('blacklist/ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Remove IP from blacklist',
    description: 'Remove an IP address from the blacklist.'
  })
  @ApiParam({
    name: 'ip',
    description: 'IP address to remove from blacklist',
    example: '192.168.1.100'
  })
  @ApiResponse({
    status: 200,
    description: 'IP removed from blacklist successfully'
  })
  @ApiNotFoundResponse({
    description: 'IP not found in blacklist'
  })
  async removeIpFromBlacklist(
    @Param('ip') ip: string
  ): Promise<BaseResponseDto<{ ip: string; status: string }>> {
    this.logger.log('Admin: Removing IP from blacklist', { ip });

    const result = await this.adminBusinessService.removeIpFromBlacklist(ip);
    return new BaseResponseDto(result, `IP ${ip} has been removed from blacklist`);
  }

  /**
   * 특정 IP의 블랙리스트 정보 조회
   */
  @Get('blacklist/ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get blacklist info for specific IP',
    description: 'Retrieve detailed blacklist information for a specific IP address.'
  })
  @ApiParam({
    name: 'ip',
    description: 'IP address to check',
    example: '192.168.1.100'
  })
  @ApiResponse({
    status: 200,
    description: 'IP blacklist info retrieved successfully'
  })
  @ApiNotFoundResponse({
    description: 'IP not found in blacklist'
  })
  async getBlacklistInfo(
    @Param('ip') ip: string
  ): Promise<BaseResponseDto<BlacklistEntry | null>> {
    this.logger.log('Admin: Getting blacklist info for IP', { ip });

    const info = await this.adminBusinessService.getBlacklistInfo(ip);
    
    if (!info) {
      return new BaseResponseDto(null, `IP ${ip} is not in blacklist`);
    }

    return new BaseResponseDto(info, `Blacklist info retrieved for ${ip}`);
  }

  /**
   * 만료된 블랙리스트 항목 정리
   */
  @Post('blacklist/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cleanup expired blacklist entries',
    description: 'Remove expired entries from the blacklist to optimize performance.'
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully'
  })
  async cleanupExpiredEntries(): Promise<BaseResponseDto<{ removedCount: number }>> {
    this.logger.log('Admin: Starting blacklist cleanup');

    const result = await this.adminBusinessService.cleanupExpiredEntries();
    return new BaseResponseDto(result, `Cleanup completed: ${result.removedCount} entries removed`);
  }

  // ============================================
  // 시스템 관리
  // ============================================

  /**
   * 시스템 상태 조회
   */
  @Get('system/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system status',
    description: 'Retrieve overall system health and status information.'
  })
  @ApiResponse({
    status: 200,
    description: 'System status retrieved successfully'
  })
  async getSystemStatus(): Promise<BaseResponseDto<{
    status: string;
    uptime: number;
    memory: any;
    security: any;
  }>> {
    this.logger.log('Admin: System status requested');

    // 컨트롤러에서는 단순한 데이터 조합만 수행
    const systemInfo = {
      status: 'operational',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
      },
      security: {
        blacklistedIps: 'Available via /admin/blacklist/stats',
        activeGuards: ['UserAgent', 'IPBlacklist', 'Honeypot', 'reCAPTCHA']
      }
    };

    return new BaseResponseDto(systemInfo, 'System status retrieved successfully');
  }
}
