import { Controller, Get, Req, Logger, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestUtils } from '../../common/utils/request.utils';
import { ExtendedRequest } from '../../core/types';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

import { ClientInfoService, ClientInfo } from './client-info.service';

@ApiTags('Client Info')
@Controller('api/client')
export class ClientInfoController {
  private readonly logger = new Logger(ClientInfoController.name);

  constructor(private readonly clientInfoService: ClientInfoService) {}

  @Get('info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get client information' })
  async getClientInfo(@Req() request: Request, @Query('detailed') detailed?: boolean) {
    this.logger.log(
      `Client info requested from ${RequestUtils.hashIp(RequestUtils.extractClientIp(request as ExtendedRequest), 'log')}`,
    );

    try {
      const clientInfo = await this.clientInfoService.getClientInfo(request);

      if (detailed === false) {
        return this.getSimplifiedInfo(clientInfo);
      }

      return clientInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get client info: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  @Get('ip')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get client IP information' })
  async getClientIpInfo(@Req() request: Request) {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      ipHash: RequestUtils.hashIp(clientInfo.ip.address, 'client'),
      type: clientInfo.ip.type,
      isPrivate: clientInfo.ip.isPrivate,
    };
  }

  @Get('security')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get security analysis' })
  async getSecurityAnalysis(@Req() request: Request) {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      ipHash: RequestUtils.hashIp(clientInfo.ip.address, 'client'),
      security: clientInfo.security,
      client: {
        isBot: clientInfo.client.isBot,
        isCrawler: clientInfo.client.isCrawler,
        deviceType: clientInfo.client.deviceType,
      },
    };
  }

  @Get('headers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get header analysis' })
  async getHeaders(@Req() request: Request) {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      headers: clientInfo.headers,
      userAgent: clientInfo.client.userAgent,
      suspicious: clientInfo.headers.suspicious,
      missing: clientInfo.headers.missing,
    };
  }

  private getSimplifiedInfo(clientInfo: ClientInfo) {
    return {
      ipHash: RequestUtils.hashIp(clientInfo.ip.address, 'client'),
      location: {
        country: clientInfo.location.country,
        city: clientInfo.location.city,
      },
      device: clientInfo.client.deviceType,
      browser: clientInfo.client.browser,
      os: clientInfo.client.os,
      riskScore: clientInfo.security.riskScore,
    };
  }
}
