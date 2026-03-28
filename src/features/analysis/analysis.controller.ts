import { Controller, Get, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles } from '../auth/auth.decorators';
import { AnalysisService } from './analysis.service';
import { ThreatScoreService } from '../../common/services/threat-score.service';
import { ResponseBuilder } from '../../common/utils/response.builder';
import { RequestUtils } from '../../common/utils/request.utils';

function validateIp(ip: string): string {
  if (!RequestUtils.isValidIpAddress(ip)) {
    throw new BadRequestException(`Invalid IP address: ${ip}`);
  }
  return ip;
}

@ApiTags('Threat Analysis')
@ApiBearerAuth('JWT-auth')
@Controller('admin/analysis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@SkipThrottle()
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly threatScoreService: ThreatScoreService,
  ) {}

  @Get('time-distribution')
  @ApiOperation({ summary: 'Get time distribution of blocked requests' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 24 })
  async getTimeDistribution(@Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number) {
    return ResponseBuilder.success(await this.analysisService.getTimeDistribution(Math.min(hours, 720)));
  }

  @Get('top-ips')
  @ApiOperation({ summary: 'Get top blocked IPs' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getTopIps(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return ResponseBuilder.success(await this.analysisService.getTopBlockedIps(Math.min(limit, 100)));
  }

  @Get('top-user-agents')
  @ApiOperation({ summary: 'Get top blocked User-Agents' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getTopUserAgents(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return ResponseBuilder.success(await this.analysisService.getTopBlockedUserAgents(Math.min(limit, 100)));
  }

  @Get('endpoints')
  @ApiOperation({ summary: 'Get endpoint analysis' })
  async getEndpoints() {
    return ResponseBuilder.success(await this.analysisService.getEndpointAnalysis());
  }

  @Get('interval/:ip')
  @ApiOperation({ summary: 'Analyze request intervals for an IP (bot detection)' })
  @ApiParam({ name: 'ip', description: 'IP address to analyze' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 24 })
  async getIntervalAnalysis(
    @Param('ip') ip: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(await this.analysisService.getRequestIntervalAnalysis(validateIp(ip), Math.min(hours, 720)));
  }

  @Get('patterns')
  @ApiOperation({ summary: 'Get attack pattern clusters' })
  async getPatterns() {
    return ResponseBuilder.success(await this.analysisService.getAttackPatterns());
  }

  @Get('similar/:ip')
  @ApiOperation({ summary: 'Find IPs with similar attack patterns' })
  @ApiParam({ name: 'ip', description: 'IP address to find similar patterns for' })
  async getSimilarPatterns(@Param('ip') ip: string) {
    return ResponseBuilder.success(await this.analysisService.getSimilarPatterns(validateIp(ip)));
  }

  @Get('threat-score/:ip')
  @ApiOperation({ summary: 'Get threat score for an IP' })
  @ApiParam({ name: 'ip', description: 'IP address' })
  async getThreatScore(@Param('ip') ip: string) {
    const score = await this.threatScoreService.getScore(validateIp(ip));
    return ResponseBuilder.success(score ?? { totalScore: 0, violations: 0, message: 'No threat data' });
  }

  @Get('realtime/behavior/:ip')
  @ApiOperation({ summary: 'Real-time behavioral analysis for an IP (cache-based, no DB query)' })
  @ApiParam({ name: 'ip', description: 'IP address' })
  async getRealtimeBehavior(@Param('ip') ip: string) {
    return ResponseBuilder.success(await this.analysisService.getRealtimeBehaviorAnalysis(validateIp(ip)));
  }

  @Get('realtime/log/:ip')
  @ApiOperation({ summary: 'Real-time request log for an IP (last 1 hour, cache)' })
  @ApiParam({ name: 'ip', description: 'IP address' })
  async getRealtimeLog(@Param('ip') ip: string) {
    return ResponseBuilder.success(await this.analysisService.getRealtimeRequestLog(validateIp(ip)));
  }

  @Get('fingerprint/:hash')
  @ApiOperation({ summary: 'Analyze a browser fingerprint for proxy rotation detection' })
  @ApiParam({ name: 'hash', description: 'Fingerprint hash to analyze' })
  async getFingerprintAnalysis(@Param('hash') hash: string) {
    if (!hash || hash.length < 8) {
      throw new BadRequestException('Invalid fingerprint hash');
    }
    return ResponseBuilder.success(await this.analysisService.getFingerprintAnalysis(hash));
  }
}
