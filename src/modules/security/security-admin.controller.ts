import { SecurityReason } from '../../types';
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
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';
import { Public } from './security.guard';

/**
 * Security Admin Controller
 * 보안 관리 기능을 제공하는 컨트롤러
 */
@Controller('admin/security')
export class SecurityAdminController {
  
  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * IP 블랙리스트 통계 조회
   */
  @Get('blacklist/stats')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getBlacklistStats() {
    const stats = await this.ipBlacklistService.getStatistics();
    
    return {
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 블랙리스트된 IP 목록 조회
   */
  @Get('blacklist/ips')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getBlacklistedIps() {
    const ips = await this.ipBlacklistService.getAllBlacklistedIps();
    
    return {
      status: 'success',
      data: {
        count: ips.length,
        ips: ips
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * IP를 블랙리스트에 추가
   */
  @Post('blacklist/ip')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async addIpToBlacklist(@Body() body: { ip: string; reason?: string; ttl?: number }) {
    await this.ipBlacklistService.blacklistIp(
      body.ip, 
      (body.reason as SecurityReason) || 'MANUAL_ADMIN_ACTION', 
      body.ttl
    );
    
    return {
      status: 'success',
      message: `IP ${body.ip} has been blacklisted`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * IP를 블랙리스트에서 제거
   */
  @Delete('blacklist/ip/:ip')
  @Public()
  @HttpCode(HttpStatus.OK)
  async removeIpFromBlacklist(@Param('ip') ip: string) {
    await this.ipBlacklistService.removeFromBlacklist(ip);
    
    return {
      status: 'success',
      message: `IP ${ip} has been removed from blacklist`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 특정 IP 정보 조회
   */
  @Get('blacklist/ip/:ip')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getIpInfo(@Param('ip') ip: string) {
    const info = await this.ipBlacklistService.getIpInfo(ip);
    
    return {
      status: 'success',
      data: {
        ip: ip,
        info: info
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 보안 시스템 상태 조회
   */
  @Get('status')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getSecurityStatus() {
    const stats = await this.ipBlacklistService.getStatistics();
    
    return {
      status: 'success',
      data: {
        system: 'Anti-Scraping Security',
        version: '1.0.0',
        uptime: process.uptime(),
        redis: {
          connected: stats.redisConnected,
          totalBlacklisted: stats.totalBlocked
        },
        guards: [
          'IP Blacklist Guard',
          'User-Agent Guard', 
          'Headless Browser Guard',
          'Honeypot Guard',
          'reCAPTCHA Guard'
        ]
      },
      timestamp: new Date().toISOString()
    };
  }
}
