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
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { IpBlacklistService } from '../services/ip-blacklist.service';
import { IpStatistics, BlacklistEntry, SecurityReason } from '../../../core/types';

/**
 * Security Admin Controller
 * 보안 관련 관리 기능을 제공하는 컨트롤러
 */
@ApiTags('Security Admin')
@Controller('admin/security')
@SkipThrottle() // 관리자는 rate limiting 제외
export class SecurityAdminController {
  private readonly logger = new Logger(SecurityAdminController.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * IP 차단
   */
  @Post('blacklist/ip')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Block an IP address' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ip: { type: 'string', example: '192.168.1.100' },
        reason: { type: 'string', example: 'MANUAL_ADMIN_ACTION' },
        ttl: { type: 'number', example: 86400 }
      }
    }
  })
  async blockIp(@Body() body: { ip: string; reason: SecurityReason; ttl?: number }) {
    const { ip, reason, ttl } = body;
    
    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new Error('Invalid IP address format');
    }

    await this.ipBlacklistService.blockIp(ip, reason, ttl);
    
    this.logger.log(`Admin blocked IP: ${ip} for reason: ${reason}`);
    
    return {
      success: true,
      message: `IP ${ip} has been blocked`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * IP 차단 해제
   */
  @Delete('blacklist/ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock an IP address' })
  @ApiParam({ name: 'ip', description: 'IP address to unblock' })
  async unblockIp(@Param('ip') ip: string) {
    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new Error('Invalid IP address format');
    }

    const wasBlocked = await this.ipBlacklistService.isBlocked(ip);
    
    if (!wasBlocked) {
      return {
        success: false,
        message: `IP ${ip} was not blocked`,
        timestamp: new Date().toISOString(),
      };
    }

    await this.ipBlacklistService.unblockIp(ip);
    
    this.logger.log(`Admin unblocked IP: ${ip}`);
    
    return {
      success: true,
      message: `IP ${ip} has been unblocked`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 차단된 IP 목록 조회
   */
  @Get('blacklist')
  @ApiOperation({ summary: 'Get all blocked IPs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBlockedIps(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const allEntries = await this.ipBlacklistService.getBlocklist();
    
    // 간단한 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const entries = allEntries.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total: allEntries.length,
        totalPages: Math.ceil(allEntries.length / limit),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * IP 정보 조회
   */
  @Get('blacklist/ip/:ip')
  @ApiOperation({ summary: 'Get IP block information' })
  @ApiParam({ name: 'ip', description: 'IP address to check' })
  async getIpInfo(@Param('ip') ip: string) {
    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new Error('Invalid IP address format');
    }

    const info = await this.ipBlacklistService.getBlockInfo(ip);
    
    return {
      success: true,
      data: info,
      isBlocked: !!info,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * IP 차단 통계
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Get IP blocking statistics' })
  async getStatistics(): Promise<{
    success: boolean;
    data: IpStatistics;
    timestamp: string;
  }> {
    const stats = await this.ipBlacklistService.getStatistics();
    
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }
}
