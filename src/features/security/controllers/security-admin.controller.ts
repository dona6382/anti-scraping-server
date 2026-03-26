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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { IpBlacklistService } from '../../../common/services/ip-blacklist.service';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guards';
import { Roles } from '../../auth/auth.decorators';
import { BlockIpDto, CidrBlockDto } from '../dto/security-admin.dto';
import { ResponseBuilder } from '../../../common/utils/response.builder';
import { PaginationUtils } from '../../../common/utils/pagination.utils';
import { RequestUtils } from '../../../common/utils/request.utils';
import { CidrUtils } from '../../../common/utils/cidr.utils';

/**
 * Security Admin Controller
 * 보안 관련 관리 기능을 제공하는 컨트롤러
 * JWT 인증 + admin 역할 필요
 */
@ApiTags('Security Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@SkipThrottle()
export class SecurityAdminController {
  private readonly logger = new Logger(SecurityAdminController.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  /**
   * IP 차단
   */
  @Post('blacklist/ip')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Block an IP address' })
  async blockIp(@Body() dto: BlockIpDto) {
    await this.ipBlacklistService.blockIp(dto.ip, dto.reason, dto.ttl);
    this.logger.log(`Admin blocked IP: ${RequestUtils.hashIp(dto.ip, 'log')} for reason: ${dto.reason}`);
    return ResponseBuilder.success(null, 'IP has been blocked');
  }

  @Delete('blacklist/ip/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock an IP address' })
  @ApiParam({ name: 'ip', description: 'IP address to unblock' })
  async unblockIp(@Param('ip') ip: string) {
    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new BadRequestException('Invalid IP address format');
    }

    const wasBlocked = await this.ipBlacklistService.isBlocked(ip);
    if (!wasBlocked) {
      return ResponseBuilder.error(`IP ${ip} was not blocked`);
    }

    await this.ipBlacklistService.unblockIp(ip);
    this.logger.log(`Admin unblocked IP: ${RequestUtils.hashIp(ip, 'log')}`);
    return ResponseBuilder.success(null, 'IP has been unblocked');
  }

  @Get('blacklist')
  @ApiOperation({ summary: 'Get all blocked IPs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBlockedIps(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const allEntries = await this.ipBlacklistService.getBlocklist();
    const { page: p, limit: l, skip } = PaginationUtils.parse(page, limit);
    const entries = allEntries.slice(skip, skip + l);

    return ResponseBuilder.paginated(entries, p, l, allEntries.length);
  }

  @Get('blacklist/ip/:ip')
  @ApiOperation({ summary: 'Get IP block information' })
  @ApiParam({ name: 'ip', description: 'IP address to check' })
  async getIpInfo(@Param('ip') ip: string) {
    if (!this.ipBlacklistService.isValidIp(ip)) {
      throw new BadRequestException('Invalid IP address format');
    }
    const info = await this.ipBlacklistService.getBlockInfo(ip);
    return ResponseBuilder.success({ ...info, isBlocked: !!info });
  }

  /**
   * CIDR 범위 차단
   */
  @Post('blacklist/cidr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Block a CIDR range' })
  async blockCidr(@Body() dto: CidrBlockDto) {
    if (!CidrUtils.isValidCidr(dto.cidr)) {
      throw new BadRequestException('Invalid CIDR format (e.g. 192.168.0.0/24)');
    }
    await this.ipBlacklistService.blockCidr(dto.cidr, dto.reason, dto.ttl);
    this.logger.log(`Admin blocked CIDR: ${dto.cidr} for reason: ${dto.reason}`);
    return ResponseBuilder.success(null, 'CIDR range has been blocked');
  }

  /**
   * CIDR 범위 차단 해제
   */
  @Delete('blacklist/cidr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock a CIDR range' })
  @ApiQuery({ name: 'cidr', required: true, type: String, example: '192.168.1.0/24' })
  async unblockCidr(@Query('cidr') cidr: string) {
    if (!CidrUtils.isValidCidr(cidr)) {
      throw new BadRequestException('Invalid CIDR format');
    }
    await this.ipBlacklistService.unblockCidr(cidr);
    this.logger.log(`Admin unblocked CIDR: ${cidr}`);
    return ResponseBuilder.success(null, 'CIDR range has been unblocked');
  }

  /**
   * 차단된 CIDR 목록 조회
   */
  @Get('blacklist/cidrs')
  @ApiOperation({ summary: 'Get all blocked CIDR ranges' })
  async getBlockedCidrs() {
    const entries = await this.ipBlacklistService.getBlockedCidrs();
    return ResponseBuilder.success(entries);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get IP blocking statistics' })
  async getStatistics() {
    return ResponseBuilder.success(
      await this.ipBlacklistService.getStatistics(),
    );
  }
}
