import { Controller, Get, Post, Body, Req, Res, HttpStatus, Logger, Header, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientInfoService, ClientInfo } from './client-info.service';

@Controller('api/v1/client')
export class ClientInfoController {
  private readonly logger = new Logger(ClientInfoController.name);
  constructor(private readonly clientInfoService: ClientInfoService) {}

  @Get('info')
  async getClientInfo(@Req() request: Request, @Query('detailed') detailed?: boolean): Promise<ClientInfo> {
    this.logger.log(`Client info requested from ${this.getClientIp(request)}`);
    try {
      const clientInfo = await this.clientInfoService.getClientInfo(request);
      if (detailed === false) {
        return this.getSimplifiedInfo(clientInfo);
      }
      return clientInfo;
    } catch (error) {
      this.logger.error(`Failed to get client info: ${error.message}`, error.stack);
      throw error;
    }
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIp) {
      return realIp;
    }
    return request.socket?.remoteAddress || request.ip || 'unknown';
  }

  @Get('ip')
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

  @Get('proxy')
  async detectProxy(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      proxy: clientInfo.proxy,
      vpn: clientInfo.ip.isVpn,
      tor: clientInfo.ip.isTor,
      riskScore: clientInfo.security.riskScore,
      recommendations: clientInfo.security.recommendations,
    };
  }

  @Get('location')
  async getLocation(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      ip: clientInfo.ip.address,
      location: clientInfo.location,
    };
  }

  @Get('security')
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
  async getHeaders(@Req() request: Request): Promise<any> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    return {
      headers: clientInfo.headers,
      userAgent: clientInfo.client.userAgent,
      suspicious: clientInfo.headers.suspicious,
      missing: clientInfo.headers.missing,
    };
  }

  @Get('view')
  @Header('Content-Type', 'text/html')
  async viewClientInfo(@Req() request: Request, @Res() response: Response): Promise<void> {
    const clientInfo = await this.clientInfoService.getClientInfo(request);
    const html = this.generateHtmlView(clientInfo);
    response.status(HttpStatus.OK).send(html);
  }

  @Post('collect')
  async collectClientSideInfo(@Req() request: Request, @Body() clientData: any): Promise<any> {
    const serverInfo = await this.clientInfoService.getClientInfo(request);
    const mergedInfo = {
      ...serverInfo,
      technology: {
        ...serverInfo.technology,
        ...clientData.technology,
        javascript: true,
      },
      client: {
        ...serverInfo.client,
        ...clientData.client,
      },
    };
    return mergedInfo;
  }

  private generateHtmlView(clientInfo: ClientInfo): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Information</title>
    <style>
        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { text-align: center; color: white; margin-bottom: 30px; }
        .info-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
        .info-label { color: #666; font-weight: 500; }
        .info-value { color: #333; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Client Information Analysis</h1>
        <div class="info-card">
            <h2>IP Information</h2>
            <div class="info-item"><span class="info-label">IP Address</span><span class="info-value">${clientInfo.ip.address}</span></div>
            <div class="info-item"><span class="info-label">Type</span><span class="info-value">${clientInfo.ip.type}</span></div>
            <div class="info-item"><span class="info-label">Private</span><span class="info-value">${clientInfo.ip.isPrivate ? 'Yes' : 'No'}</span></div>
            <div class="info-item"><span class="info-label">Proxy</span><span class="info-value">${clientInfo.ip.isProxy ? 'Detected' : 'Not Detected'}</span></div>
            <div class="info-item"><span class="info-label">VPN</span><span class="info-value">${clientInfo.ip.isVpn ? 'Detected' : 'Not Detected'}</span></div>
            <div class="info-item"><span class="info-label">Tor</span><span class="info-value">${clientInfo.ip.isTor ? 'Detected' : 'Not Detected'}</span></div>
        </div>
        <div class="info-card">
            <h2>Location</h2>
            <div class="info-item"><span class="info-label">Country</span><span class="info-value">${clientInfo.location.country || 'Unknown'}</span></div>
            <div class="info-item"><span class="info-label">City</span><span class="info-value">${clientInfo.location.city || 'Unknown'}</span></div>
            <div class="info-item"><span class="info-label">ISP</span><span class="info-value">${clientInfo.location.isp || 'Unknown'}</span></div>
        </div>
        <div class="info-card">
            <h2>Client Details</h2>
            <div class="info-item"><span class="info-label">Browser</span><span class="info-value">${clientInfo.client.browser || 'Unknown'}</span></div>
            <div class="info-item"><span class="info-label">OS</span><span class="info-value">${clientInfo.client.os || 'Unknown'}</span></div>
            <div class="info-item"><span class="info-label">Device Type</span><span class="info-value">${clientInfo.client.deviceType}</span></div>
        </div>
        <div class="info-card">
            <h2>Security Analysis</h2>
            <div class="info-item"><span class="info-label">Risk Score</span><span class="info-value">${clientInfo.security.riskScore}/100</span></div>
            <div class="info-item"><span class="info-label">Threats</span><span class="info-value">${clientInfo.security.threats.join(', ') || 'None'}</span></div>
        </div>
    </div>
</body>
</html>`;
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
