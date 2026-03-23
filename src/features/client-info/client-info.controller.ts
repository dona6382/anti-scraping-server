import { Controller, Get, Req, Logger, Query } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { ClientInfoService, ClientInfo } from './client-info.service';
import { RequestUtils } from '../../common/utils/request.utils';
import { ExtendedRequest } from '../../core/types';

@ApiTags('Client Info')
@Controller('api/client')
export class ClientInfoController {
  private readonly logger = new Logger(ClientInfoController.name);
  
  constructor(private readonly clientInfoService: ClientInfoService) {}

  @Get('info')
  @ApiOperation({ summary: 'Get client information' })
  async getClientInfo(@Req() request: Request, @Query('detailed') detailed?: boolean): Promise<ClientInfo> {
    this.logger.log(`Client info requested from ${RequestUtils.extractClientIp(request as ExtendedRequest)}`);
    
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
  @ApiOperation({ summary: 'Get client IP information' })
  async getClientIpInfo(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      ip: clientInfo.ip.address,
      type: clientInfo.ip.type,
      isPrivate: clientInfo.ip.isPrivate,
      isProxy: clientInfo.ip.isProxy,
      isVpn: clientInfo.ip.isVpn,
      isTor: clientInfo.ip.isTor,
    };
  }

  @Get('security')
  @ApiOperation({ summary: 'Get security analysis' })
  async getSecurityAnalysis(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      ip: clientInfo.ip.address,
      security: clientInfo.security,
      proxy: clientInfo.proxy,
      client: {
        isBot: clientInfo.client.isBot,
        isCrawler: clientInfo.client.isCrawler,
        deviceType: clientInfo.client.deviceType,
      },
    };
  }

  @Get('headers')
  @ApiOperation({ summary: 'Get header analysis' })
  async getHeaders(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      headers: clientInfo.headers,
      userAgent: clientInfo.client.userAgent,
      suspicious: clientInfo.headers.suspicious,
      missing: clientInfo.headers.missing,
    };
  }

  private getSimplifiedInfo(clientInfo: ClientInfo): any {
    return {
      ip: clientInfo.ip.address,
      location: {
        country: clientInfo.location.country,
        city: clientInfo.location.city,
      },
      proxy: clientInfo.proxy.detected,
      vpn: clientInfo.ip.isVpn,
      tor: clientInfo.ip.isTor,
      device: clientInfo.client.deviceType,
      browser: clientInfo.client.browser,
      os: clientInfo.client.os,
      riskScore: clientInfo.security.riskScore,
    };
  }
}
