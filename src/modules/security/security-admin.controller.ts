import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { IpManagementService } from '../../core/application/services/ip-management.service';
import { Public } from './security.guard';

/**
 * Security Admin Controller
 * 보안 관리 기능을 제공하는 컨트롤러
 */
@Controller('admin/security')
export class SecurityAdminController {
  constructor(
    private readonly ipManagementService: IpManagementService,
  ) {}

  /**
   * Get security statistics
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStatistics() {
    const stats = await this.ipManagementService.getStatistics();
    
    return {
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all blacklisted IPs
   */
  @Get('blacklist')
  @HttpCode(HttpStatus.OK)
  async getBlacklistedIps() {
    const ips = await this.ipManagementService.getBlacklistedIps();
    
    return {
      status: 'success',
      data: {
        ips,
        total: ips.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Add IP to blacklist
   */
  @Post('blacklist')
  @HttpCode(HttpStatus.CREATED)
  async blacklistIp(
    @Body() dto: {
      ip: string;
      reason: string;
      ttl?: number;
    }
  ) {
    await this.ipManagementService.blacklist(dto.ip, dto.reason, dto.ttl);
    
    return {
      status: 'success',
      message: `IP ${dto.ip} has been blacklisted`,
      data: {
        ip: dto.ip,
        reason: dto.reason,
        ttl: dto.ttl,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Remove IP from blacklist
   */
  @Delete('blacklist/:ip')
  @HttpCode(HttpStatus.OK)
  async whitelistIp(@Param('ip') ip: string) {
    await this.ipManagementService.whitelist(ip);
    
    return {
      status: 'success',
      message: `IP ${ip} has been removed from blacklist`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if IP is blacklisted
   */
  @Get('blacklist/:ip')
  @HttpCode(HttpStatus.OK)
  async checkIp(@Param('ip') ip: string) {
    const isBlacklisted = await this.ipManagementService.isBlacklisted(ip);
    const validation = await this.ipManagementService.validate(ip);
    
    return {
      status: 'success',
      data: {
        ip,
        isBlacklisted,
        validation,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Record failed attempt for IP
   */
  @Post('failed-attempt')
  @HttpCode(HttpStatus.OK)
  async recordFailedAttempt(
    @Body() dto: {
      ip: string;
      reason: string;
    }
  ) {
    await this.ipManagementService.recordFailedAttempt(dto.ip, dto.reason);
    
    return {
      status: 'success',
      message: `Failed attempt recorded for IP ${dto.ip}`,
      timestamp: new Date().toISOString(),
    };
  }
}
