import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles } from '../auth/auth.decorators';
import { AnalysisService } from './analysis.service';
import { ThreatScoreService } from '../../common/services/threat-score.service';
import { ResponseBuilder } from '../../common/utils/response.builder';

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
  async getTimeDistribution(@Query('hours') hours = 24) {
    return ResponseBuilder.success(await this.analysisService.getTimeDistribution(hours));
  }

  @Get('top-ips')
  @ApiOperation({ summary: 'Get top blocked IPs' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getTopIps(@Query('limit') limit = 20) {
    return ResponseBuilder.success(await this.analysisService.getTopBlockedIps(limit));
  }

  @Get('top-user-agents')
  @ApiOperation({ summary: 'Get top blocked User-Agents' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getTopUserAgents(@Query('limit') limit = 20) {
    return ResponseBuilder.success(await this.analysisService.getTopBlockedUserAgents(limit));
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
  async getIntervalAnalysis(@Param('ip') ip: string, @Query('hours') hours = 24) {
    return ResponseBuilder.success(await this.analysisService.getRequestIntervalAnalysis(ip, hours));
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
    return ResponseBuilder.success(await this.analysisService.getSimilarPatterns(ip));
  }

  @Get('threat-score/:ip')
  @ApiOperation({ summary: 'Get threat score for an IP' })
  @ApiParam({ name: 'ip', description: 'IP address' })
  async getThreatScore(@Param('ip') ip: string) {
    const score = await this.threatScoreService.getScore(ip);
    return ResponseBuilder.success(score ?? { totalScore: 0, violations: 0, message: 'No threat data' });
  }
}
