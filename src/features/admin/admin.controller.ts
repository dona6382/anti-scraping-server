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
import { UseGuards } from '@nestjs/common';

import { AdminService } from './admin.service';
import { SecurityReason } from '../../core/types';
// import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards'; // 임시 비활성화
// import { Roles, CurrentUser } from '../auth/auth.decorators'; // 임시 비활성화
// import { User } from '../../core/database/entities'; // 임시 비활성화

/**
 * Admin Controller
 * 관리자 전용 기능을 제공하는 컨트롤러
 */
@ApiTags('Admin')
@Controller('admin')
// @UseGuards(JwtAuthGuard, RolesGuard) // 임시 비활성화 - Auth 모듈 필요
// @Roles('admin') // 임시 비활성화 - Auth 모듈 필요
@SkipThrottle() // 관리자는 rate limiting 제외
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  /**
   * 시스템 정보 조회
   */
  @Get('system/info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system information',
    description: 'Retrieve comprehensive system information and statistics.'
  })
  @ApiResponse({ status: 200, description: 'System information retrieved successfully' })
  async getSystemInfo() {
    this.logger.log('Admin: System info requested');
    return await this.adminService.getSystemInfo();
  }

  /**
   * 시스템 통계 조회
   */
  @Get('system/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system statistics',
    description: 'Retrieve system performance and usage statistics.'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getSystemStats() {
    this.logger.log('Admin: System stats requested');
    return await this.adminService.getSystemStats();
  }

  /**
   * 보안 이벤트 로그 조회
   */
  @Get('security/events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get security events',
    description: 'Retrieve recent security events and violations.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'severity', required: false, type: String, example: 'HIGH' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  async getSecurityEvents(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('severity') severity?: string
  ) {
    this.logger.log('Admin: Security events requested');
    return await this.adminService.getSecurityEvents({ page, limit, severity });
  }

  /**
   * 활성 세션 조회
   */
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get active sessions',
    description: 'Retrieve information about active user sessions.'
  })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved successfully' })
  async getActiveSessions() {
    this.logger.log('Admin: Active sessions requested');
    return await this.adminService.getActiveSessions();
  }

  /**
   * 시스템 설정 조회
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get system configuration',
    description: 'Retrieve current system configuration (sensitive values masked).'
  })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  async getSystemConfig() {
    this.logger.log('Admin: System config requested');
    return await this.adminService.getSystemConfig();
  }

  /**
   * 시스템 설정 업데이트
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update system configuration',
    description: 'Update system configuration settings.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', example: 'SECURITY_STRICT_MODE' },
        value: { type: 'string', example: 'true' }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  async updateSystemConfig(@Body() body: { key: string; value: string }) {
    this.logger.log(`Admin: Config update requested for ${body.key}`);
    return await this.adminService.updateSystemConfig(body.key, body.value);
  }

  /**
   * 캐시 관리
   */
  @Delete('cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Clear system cache',
    description: 'Clear all system caches.'
  })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    this.logger.log('Admin: Cache clear requested');
    return await this.adminService.clearSystemCache();
  }

  /**
   * 로그 레벨 변경
   */
  @Post('system/log-level')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Change log level',
    description: 'Change system log level dynamically.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'], example: 'debug' }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Log level changed successfully' })
  async changeLogLevel(@Body() body: { level: string }) {
    this.logger.log(`Admin: Log level change requested to ${body.level}`);
    return await this.adminService.changeLogLevel(body.level);
  }

  /**
   * 헬스체크 강제 실행
   */
  @Post('system/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Force health check',
    description: 'Force execute a comprehensive system health check.'
  })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async forceHealthCheck() {
    this.logger.log('Admin: Force health check requested');
    return await this.adminService.forceHealthCheck();
  }
}
