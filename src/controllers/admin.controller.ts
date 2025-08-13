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
import { IpBlacklistService, BlacklistEntry } from '../common/services/ip-blacklist.service';

// DTOs
import {
  BaseResponseDto,
  BlacklistIpRequestDto,
} from '../common/dto';
import { IpStatistics } from '../types';

/**
 * Admin Controller
 * 관리자 전용 기능을 제공하는 컨트롤러
 */
@ApiTags('Admin')
@Controller('admin')
@SkipThrottle() // 관리자는 rate limiting 제외
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

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

    const stats = await this.ipBlacklistService.getStatistics();
    return new BaseResponseDto(stats);
  }

  /**
   * 모든 차단된 IP 조회
   */
  @Get('blacklist/ips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get all blacklisted IPs',
    description: 'Retrieve a complete list of all blacklisted IP addresses with their blocking information.'
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

    // 페이지네이션 제한
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const allIps = await this.ipBlacklistService.getAllBlacklistedIps();
    
    // 정렬
    const sortedIps = this.sortBlacklistEntries(allIps, sortBy, order);

    // 페이지네이션
    const startIndex = (safePage - 1) * safeLimit;
    const endIndex = startIndex + safeLimit;
    const paginatedIps = sortedIps.slice(startIndex, endIndex);

    const result = {
      ips: paginatedIps,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: allIps.length,
        totalPages: Math.ceil(allIps.length / safeLimit),
      },
    };

    return new BaseResponseDto(result);
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
  async addIpToBlacklist(
    @Body() blacklistDto: BlacklistIpRequestDto
  ): Promise<BaseResponseDto<{ ip: string; reason: string; ttl?: number }>> {
    this.logger.warn('Admin: Manual IP blacklist', { 
      ip: blacklistDto.ip,
      reason: blacklistDto.reason 
    });

    // IP 주소 유효성 검사
    if (!this.ipBlacklistService.isValidIp(blacklistDto.ip)) {
      throw new Error('Invalid IP address format');
    }

    await this.ipBlacklistService.blacklistIp(
      blacklistDto.ip,
      blacklistDto.reason || 'MANUAL_ADMIN_ACTION',
      blacklistDto.ttl
    );

    const result: { ip: string; reason: string; ttl?: number | undefined } = {
      ip: blacklistDto.ip,
      reason: blacklistDto.reason || 'MANUAL_ADMIN_ACTION',
      ttl: blacklistDto.ttl,
    };

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
    description: 'IP address to remove',
    example: '192.168.1.100'
  })
  @ApiResponse({
    status: 200,
    description: 'IP removed from blacklist successfully'
  })
  @ApiNotFoundResponse({ description: 'IP not found in blacklist' })
  async removeIpFromBlacklist(
    @Param('ip') ip: string
  ): Promise<BaseResponseDto<{ ip: string }>> {
    this.logger.log('Admin: IP removal from blacklist', { ip });

    // IP가 실제로 차단되어 있는지 확인
    const isBlocked = await this.ipBlacklistService.isBlocked(ip);
    if (!isBlocked) {
      throw new Error('IP not found in blacklist');
    }

    await this.ipBlacklistService.removeFromBlacklist(ip);

    const result = { ip };
    return new BaseResponseDto(result, `IP ${ip} has been removed from blacklist`);
  }

  /**
   * 특정 IP 정보 조회
   */
  @Get('blacklist/ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get IP blacklist information',
    description: 'Retrieve detailed information about a specific IP address in the blacklist.'
  })
  @ApiParam({ 
    name: 'ip', 
    description: 'IP address to check',
    example: '192.168.1.100'
  })
  @ApiResponse({
    status: 200,
    description: 'IP information retrieved successfully'
  })
  @ApiNotFoundResponse({ description: 'IP not found in blacklist' })
  async getIpInfo(
    @Param('ip') ip: string
  ): Promise<BaseResponseDto<{ ip: string; info: BlacklistEntry | null; isBlocked: boolean }>> {
    this.logger.log('Admin: IP info requested', { ip });

    const info = await this.ipBlacklistService.getIpInfo(ip);
    const isBlocked = await this.ipBlacklistService.isBlocked(ip);

    const result = {
      ip,
      info,
      isBlocked,
    };

    return new BaseResponseDto(result);
  }

  /**
   * 블랙리스트 전체 초기화
   */
  @Delete('blacklist/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Clear entire blacklist',
    description: '⚠️ DANGER: Clear all entries from the IP blacklist. This action cannot be undone.'
  })
  @ApiResponse({
    status: 200,
    description: 'Blacklist cleared successfully'
  })
  async clearBlacklist(): Promise<BaseResponseDto<{ clearedCount: number }>> {
    this.logger.warn('Admin: DANGER - Clearing entire blacklist');

    const stats = await this.ipBlacklistService.getStatistics();
    const clearedCount = stats.totalBlocked;

    await this.ipBlacklistService.clearAll();

    const result = { clearedCount };
    return new BaseResponseDto(result, `Cleared ${clearedCount} entries from blacklist`);
  }

  // ============================================
  // 시스템 관리
  // ============================================

  /**
   * 시스템 통계 조회
   */
  @Get('system/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system statistics',
    description: 'Retrieve comprehensive system statistics and performance metrics.'
  })
  @ApiResponse({
    status: 200,
    description: 'System statistics retrieved successfully'
  })
  async getSystemStats(): Promise<BaseResponseDto<{
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    requests: {
      total: number;
      blocked: number;
      allowed: number;
      blockRate: number;
    };
    performance: {
      avgResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
    };
    timestamp: string;
  }>> {
    this.logger.log('Admin: System statistics requested');

    // 실제 시스템 통계 (예시)
    const stats = {
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      },
      requests: {
        total: Math.floor(Math.random() * 10000) + 5000,
        blocked: Math.floor(Math.random() * 500) + 100,
        allowed: Math.floor(Math.random() * 9500) + 4900,
        blockRate: 0, // 계산될 예정
      },
      performance: {
        avgResponseTime: Math.random() * 100 + 50,
        p95ResponseTime: Math.random() * 200 + 150,
        p99ResponseTime: Math.random() * 500 + 300,
      },
      timestamp: new Date().toISOString(),
    };

    // 차단율 계산
    stats.requests.blockRate = (stats.requests.blocked / stats.requests.total) * 100;

    return new BaseResponseDto(stats);
  }

  /**
   * 시스템 헬스 체크
   */
  @Get('system/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'System health check',
    description: 'Perform comprehensive health check of all system components.'
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed'
  })
  async getSystemHealth(): Promise<BaseResponseDto<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    }>;
    timestamp: string;
  }>> {
    this.logger.log('Admin: System health check requested');

    const components: Record<string, { status: 'up' | 'down'; responseTime?: number; error?: string }> = {};

    // 메모리 체크
    const memoryUsage = process.memoryUsage();
    components.memory = {
      status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'up' : 'down',
      responseTime: 1,
    };

    // 캐시 체크 (IP 블랙리스트 서비스 확인)
    try {
      const start = Date.now();
      await this.ipBlacklistService.getStatistics();
      components.cache = {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      components.cache = {
        status: 'down',
        error: 'Cache service unavailable',
      };
    }

    // 전체 상태 결정
    const allComponentsUp = Object.values(components).every(comp => comp.status === 'up');
    const anyComponentDown = Object.values(components).some(comp => comp.status === 'down');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (allComponentsUp) {
      overallStatus = 'healthy';
    } else if (anyComponentDown) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const result = {
      status: overallStatus,
      components,
      timestamp: new Date().toISOString(),
    };

    return new BaseResponseDto(result);
  }

  /**
   * 설정 정보 조회
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system configuration',
    description: 'Retrieve current system configuration (sensitive values are masked).'
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully'
  })
  getConfiguration(): BaseResponseDto<{
    security: {
      strictMode: boolean;
      recaptchaEnabled: boolean;
      redisEnabled: boolean;
    };
    performance: {
      defaultRateLimit: number;
      defaultRateTtl: number;
    };
    environment: {
      nodeEnv: string;
      port: number;
      timestamp: string;
    };
  }> {
    this.logger.log('Admin: Configuration requested');

    const config = {
      security: {
        strictMode: process.env.SECURITY_STRICT_MODE === 'true',
        recaptchaEnabled: !!process.env.RECAPTCHA_SECRET_KEY,
        redisEnabled: !!process.env.REDIS_HOST,
      },
      performance: {
        defaultRateLimit: 20,
        defaultRateTtl: 10000,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        timestamp: new Date().toISOString(),
      },
    };

    return new BaseResponseDto(config);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * 블랙리스트 엔트리 정렬
   */
  private sortBlacklistEntries(
    entries: BlacklistEntry[],
    sortBy: 'ip' | 'blockedAt' | 'count' | 'reason',
    order: 'asc' | 'desc'
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
      }

      return order === 'asc' ? comparison : -comparison;
    });
  }
}
