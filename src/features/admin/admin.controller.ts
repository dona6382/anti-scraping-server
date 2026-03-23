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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles } from '../auth/auth.decorators';
import { ChangeLogLevelDto } from './dto/admin.dto';

/**
 * Admin Controller
 * 관리자 전용 기능을 제공하는 컨트롤러
 * JWT 인증 + admin 역할 필요
 */
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@SkipThrottle()
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
  @ApiOperation({ summary: 'Change log level' })
  @ApiResponse({ status: 200, description: 'Log level changed successfully' })
  async changeLogLevel(@Body() dto: ChangeLogLevelDto) {
    this.logger.log(`Admin: Log level change requested to ${dto.level}`);
    return await this.adminService.changeLogLevel(dto.level);
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
