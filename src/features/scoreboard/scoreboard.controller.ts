import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles } from '../auth/auth.decorators';
import { ScoreboardService } from './scoreboard.service';
import { ResponseBuilder } from '../../common/utils/response.builder';
import { RequestUtils } from '../../common/utils/request.utils';

function validateIp(ip: string): string {
  if (!RequestUtils.isValidIpAddress(ip)) {
    throw new BadRequestException(`Invalid IP address: ${ip}`);
  }
  return ip;
}

@ApiTags('Scoreboard')
@ApiBearerAuth('JWT-auth')
@Controller('admin/scoreboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@SkipThrottle()
export class ScoreboardController {
  constructor(private readonly scoreboardService: ScoreboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get overall defense/attack score summary' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 1 })
  async getSummary(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(
      await this.scoreboardService.getSummary(Math.max(1, Math.min(hours, 720))),
    );
  }

  @Get('layers')
  @ApiOperation({ summary: 'Get guard layer contribution breakdown' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 1 })
  async getLayers(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(
      await this.scoreboardService.getLayers(Math.max(1, Math.min(hours, 720))),
    );
  }

  @Get('attacker/:ip')
  @ApiOperation({ summary: 'Get specific IP attack analysis' })
  @ApiParam({ name: 'ip', description: 'IP address to analyze' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 1 })
  async getAttackerAnalysis(
    @Param('ip') ip: string,
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(
      await this.scoreboardService.getAttackerAnalysis(
        validateIp(ip),
        Math.max(1, Math.min(hours, 720)),
      ),
    );
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get blocked/success timeline in 5-minute intervals' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 1 })
  async getTimeline(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(
      await this.scoreboardService.getTimeline(Math.max(1, Math.min(hours, 720))),
    );
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get defense and attack improvement recommendations' })
  @ApiQuery({ name: 'hours', required: false, type: Number, example: 1 })
  async getRecommendations(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return ResponseBuilder.success(
      await this.scoreboardService.getRecommendations(Math.max(1, Math.min(hours, 720))),
    );
  }
}
