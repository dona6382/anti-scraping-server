import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import { promisify } from 'util';
import axios from 'axios';

const reverseLookup = promisify(dns.reverse);

/**
 * 클라이언트 정보 인터페이스
 */
export interface ClientInfo {
  // 기본 정보
  ip: {
    address: string;
    type: 'IPv4' | 'IPv6' | 'Unknown';
    isPrivate: boolean;
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
  };
  
  // 프록시 정보
  proxy: {
    detected: boolean;
    type: string | null;
    headers: Record<string, string>;
    suspicionLevel: 'none' | 'low' | 'medium' | 'high';
    indicators: string[];
  };
  
  // 위치 정보
  location: {
    country: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
    zipCode: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    isp: string | null;
    org: string | null;
    as: string | null;
  };
  
  // 브라우저/클라이언트 정보
  client: {
    userAgent: string;
    browser: string | null;
    browserVersion: string | null;
    os: string | null;
    osVersion: string | null;
    device: string | null;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
    isBot: boolean;
    isCrawler: boolean;
  };
  
  // 네트워크 정보
  network: {
    hostname: string | null;
    port: number | null;
    protocol: string;
    secure: boolean;
    connectionType: string | null;
  };
  
  // HTTP 헤더 정보
  headers: {
    all: Record<string, string | string[]>;
    suspicious: string[];
    missing: string[];
  };
  
  // 보안 정보
  security: {
    tlsVersion: string | null;
    cipher: string | null;
    fingerprint: string;
    riskScore: number; // 0-100
    threats: string[];
    recommendations: string[];
  };
  
  // 기술 스택 감지
  technology: {
    javascript: boolean;
    cookies: boolean;
    webrtc: boolean;
    canvas: boolean;
    webgl: boolean;
    timezone: string | null;
    screen: {
      width: number | null;
      height: number | null;
      colorDepth: number | null;
    };
    languages: string[];
    plugins: string[];
  };
  
  // 타이밍 정보
  timing: {
    requestTime: string;
    processingTime: number;
    serverTime: string;
  };
}

/**
 * Client Information Service
 * 클라이언트의 모든 정보를 수집하고 분석하는 서비스
 */
@Injectable()
export class ClientInfoService {
  private readonly logger = new Logger(ClientInfoService.name);
  private readonly ipApiUrl: string;
  private readonly vpnApiUrl: string;
  
  constructor(private readonly configService: ConfigService) {
    this.ipApiUrl = this.configService.get<string>('IP_API_URL', 'http://ip-api.com/json');
    this.vpnApiUrl = this.configService.get<string>('VPN_API_URL', 'https://vpnapi.io/api');
  }

  /**
   * 클라이언트 전체 정보 수집
   */
  async getClientInfo(request: Request): Promise<ClientInfo> {
    const startTime = Date.now();
    
    // 기본 IP 정보 추출
    const ipInfo = this.extractIpInfo(request);
    
    // 프록시 탐지
    const proxyInfo = this.detectProxy(request);
    
    // 위치 정보 조회 (비동기)
    const locationInfo = await this.getLocationInfo(ipInfo.address);
    
    // VPN/Tor 체크 (비동기)
    const vpnInfo = await this.checkVpnAndTor(ipInfo.address);
    
    // 클라이언트 정보 분석
    const clientInfo = this.analyzeClient(request);
    
    // 네트워크 정보
    const networkInfo = await this.getNetworkInfo(request, ipInfo.address);
    
    // 헤더 분석
    const headerInfo = this.analyzeHeaders(request);
    
    // 보안 정보
    const securityInfo = this.analyzeSecurityInfo(request, proxyInfo, vpnInfo);
    
    // 기술 스택 (클라이언트 사이드 정보는 JavaScript로 수집 필요)
    const technologyInfo = this.extractTechnologyInfo(request);
    
    const processingTime = Date.now() - startTime;
    
    return {
      ip: {
        ...ipInfo,
        isVpn: vpnInfo.isVpn,
        isTor: vpnInfo.isTor,
        isProxy: proxyInfo.detected,
      },
      proxy: proxyInfo,
      location: locationInfo,
      client: clientInfo,
      network: networkInfo,
      headers: headerInfo,
      security: securityInfo,
      technology: technologyInfo,
      timing: {
        requestTime: new Date(startTime).toISOString(),
        processingTime,
        serverTime: new Date().toISOString(),
      },
    };
  }

  /**
   * IP 정보 추출
   */
  private extractIpInfo(request: Request): ClientInfo['ip'] {
    const ip = this.getClientIp(request);
    
    return {
      address: ip,
      type: this.getIpType(ip),
      isPrivate: this.isPrivateIp(ip),
      isProxy: false, // 나중에 업데이트
      isVpn: false,   // 나중에 업데이트
      isTor: false,   // 나중에 업데이트
    };
  }

  /**
   * 클라이언트 IP 추출 (다양한 헤더 체크)
   */
  private getClientIp(request: Request): string {
    // 다양한 프록시 헤더 체크
    const headers = [
      'x-client-ip',
      'x-forwarded-for',
      'cf-connecting-ip',     // Cloudflare
      'fastly-client-ip',     // Fastly
      'true-client-ip',       // Akamai, Cloudflare Enterprise
      'x-real-ip',           // Nginx
      'x-cluster-client-ip',  // Rackspace
      'x-forwarded',
      'forwarded-for',
      'forwarded',
      'x-appengine-user-ip',  // Google App Engine
    ];

    for (const header of headers) {
      const value = request.headers[header];
      if (value) {
        const ip = Array.isArray(value) ? value[0] : value.toString();
        // x-forwarded-for는 쉼표로 구분된 목록일 수 있음
        const firstIp = ip?.split(',')[0]?.trim();
        if (firstIp && this.isValidIp(firstIp)) {
          return firstIp;
        }
      }
    }

    // Socket에서 IP 추출
    return request.socket?.remoteAddress || 
           request.connection?.remoteAddress || 
           request.ip || 
           'unknown';
  }

  /**
   * 프록시 탐지
   */
  private detectProxy(request: Request): ClientInfo['proxy'] {
    const suspiciousHeaders = [];
    const indicators = [];
    let suspicionLevel: ClientInfo['proxy']['suspicionLevel'] = 'none';
    
    // 프록시 관련 헤더 체크
    const proxyHeaders = {
      'x-forwarded-for': 'Forward Proxy',
      'x-forwarded-host': 'Forward Proxy',
      'x-forwarded-proto': 'Reverse Proxy',
      'x-real-ip': 'Nginx Proxy',
      'via': 'HTTP Proxy',
      'forwarded': 'HTTP Proxy',
      'x-proxy-id': 'Generic Proxy',
      'proxy-connection': 'HTTP Proxy',
      'x-bluecoat-via': 'BlueCoat Proxy',
      'x-roaming': 'Mobile Proxy',
      'x-tinyproxy': 'TinyProxy',
      'x-squid-error': 'Squid Proxy',
      'x-proxy-authorization': 'Proxy Auth',
      'x-authenticated-user': 'Authenticated Proxy',
      'client-ip': 'Possible Proxy',
      'z-forwarded-for': 'Zeus Proxy',
      'x-nokia-ipaddress': 'Nokia Proxy',
      'x-operamini-phone-ua': 'Opera Mini Proxy',
      'x-att-deviceid': 'AT&T Proxy',
    };

    let detectedType = null;
    
    for (const [header, type] of Object.entries(proxyHeaders)) {
      if (request.headers[header]) {
        suspiciousHeaders.push(header);
        indicators.push(`${header} header present`);
        if (!detectedType) detectedType = type;
      }
    }

    // 다중 IP 체크 (X-Forwarded-For 체인)
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = xForwardedFor.toString().split(',');
      if (ips.length > 1) {
        indicators.push(`Multiple IPs in chain: ${ips.length}`);
        suspicionLevel = 'medium';
      }
      if (ips.length > 3) {
        suspicionLevel = 'high';
      }
    }

    // Via 헤더 체크
    const via = request.headers['via'];
    if (via) {
      indicators.push(`Via header: ${via}`);
      suspicionLevel = 'medium';
    }

    // 포트 체크 (일반적인 프록시 포트)
    const proxyPorts = [8080, 3128, 8888, 8000, 1080, 9050, 8118];
    const port = request.socket?.remotePort;
    if (port && proxyPorts.includes(port)) {
      indicators.push(`Suspicious port: ${port}`);
      if (suspicionLevel === 'none') suspicionLevel = 'low';
    }

    // 최종 판정
    const detected = suspiciousHeaders.length > 0;
    if (detected && suspicionLevel === 'none') {
      suspicionLevel = 'low';
    }

    return {
      detected,
      type: detectedType,
      headers: Object.fromEntries(
        suspiciousHeaders.map(h => [h, request.headers[h] as string])
      ),
      suspicionLevel,
      indicators,
    };
  }

  /**
   * 위치 정보 조회
   */
  private async getLocationInfo(ip: string): Promise<ClientInfo['location']> {
    try {
      // IP-API.com 무료 API 사용 (상업용은 다른 서비스 사용 권장)
      const response = await axios.get<any>(`${this.ipApiUrl}/${ip}`, {
        params: {
          fields: 'status,message,continent,continentCode,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting',
        },
        timeout: 3000,
      });

      if (response.data.status === 'success') {
        return {
          country: response.data.country || null,
          countryCode: response.data.countryCode || null,
          region: response.data.regionName || null,
          city: response.data.city || null,
          zipCode: response.data.zip || null,
          latitude: response.data.lat || null,
          longitude: response.data.lon || null,
          timezone: response.data.timezone || null,
          isp: response.data.isp || null,
          org: response.data.org || null,
          as: response.data.as || null,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get location info: ${errorMessage}`);
    }

    return {
      country: null,
      countryCode: null,
      region: null,
      city: null,
      zipCode: null,
      latitude: null,
      longitude: null,
      timezone: null,
      isp: null,
      org: null,
      as: null,
    };
  }

  /**
   * VPN 및 Tor 체크
   */
  private async checkVpnAndTor(ip: string): Promise<{ isVpn: boolean; isTor: boolean }> {
    let isVpn = false;
    let isTor = false;

    try {
      // Tor Exit Node 체크 (간단한 방법)
      const torExitNodes = [
        // 알려진 Tor exit node IP 범위
        '198.96.155.',
        '199.87.154.',
        '192.42.116.',
      ];
      
      isTor = torExitNodes.some(range => ip.startsWith(range));

      // VPN 체크 (vpnapi.io 또는 다른 서비스 사용)
      // 주의: 실제 사용시 API 키가 필요할 수 있음
      if (this.configService.get<boolean>('VPN_CHECK_ENABLED', false)) {
        const vpnResponse = await axios.get<any>(`${this.vpnApiUrl}/${ip}`, {
          timeout: 3000,
        });
        
        if (vpnResponse.data) {
          isVpn = vpnResponse.data.security?.vpn || false;
          isTor = isTor || vpnResponse.data.security?.tor || false;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`VPN/Tor check failed: ${errorMessage}`);
    }

    return { isVpn, isTor };
  }

  /**
   * 클라이언트 정보 분석
   */
  private analyzeClient(request: Request): ClientInfo['client'] {
    const userAgent = request.headers['user-agent'] || '';
    
    // User-Agent 파싱
    const browserInfo = this.parseUserAgent(userAgent);
    
    // 봇/크롤러 탐지
    const { isBot, isCrawler } = this.detectBot(userAgent);
    
    return {
      userAgent,
      browser: browserInfo.browser,
      browserVersion: browserInfo.browserVersion,
      os: browserInfo.os,
      osVersion: browserInfo.osVersion,
      device: browserInfo.device,
      deviceType: browserInfo.deviceType,
      isBot,
      isCrawler,
    };
  }

  /**
   * User-Agent 파싱
   */
  private parseUserAgent(userAgent: string): any {
    const ua = userAgent.toLowerCase();
    
    // 브라우저 탐지
    let browser = null;
    let browserVersion = null;
    
    if (ua.includes('chrome/')) {
      browser = 'Chrome';
      browserVersion = ua.match(/chrome\/(\d+\.\d+)/)?.[1] || null;
    } else if (ua.includes('firefox/')) {
      browser = 'Firefox';
      browserVersion = ua.match(/firefox\/(\d+\.\d+)/)?.[1] || null;
    } else if (ua.includes('safari/') && !ua.includes('chrome')) {
      browser = 'Safari';
      browserVersion = ua.match(/version\/(\d+\.\d+)/)?.[1] || null;
    } else if (ua.includes('edge/')) {
      browser = 'Edge';
      browserVersion = ua.match(/edge\/(\d+\.\d+)/)?.[1] || null;
    }

    // OS 탐지
    let os = null;
    let osVersion = null;
    
    if (ua.includes('windows')) {
      os = 'Windows';
      if (ua.includes('windows nt 10.0')) osVersion = '10';
      else if (ua.includes('windows nt 6.3')) osVersion = '8.1';
      else if (ua.includes('windows nt 6.2')) osVersion = '8';
      else if (ua.includes('windows nt 6.1')) osVersion = '7';
    } else if (ua.includes('mac os x')) {
      os = 'macOS';
      osVersion = ua.match(/mac os x (\d+[._]\d+)/)?.[1]?.replace('_', '.') || null;
    } else if (ua.includes('linux')) {
      os = 'Linux';
      if (ua.includes('ubuntu')) osVersion = 'Ubuntu';
      else if (ua.includes('debian')) osVersion = 'Debian';
    } else if (ua.includes('android')) {
      os = 'Android';
      osVersion = ua.match(/android (\d+\.\d+)/)?.[1] || null;
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
      osVersion = ua.match(/os (\d+[._]\d+)/)?.[1]?.replace('_', '.') || null;
    }

    // 디바이스 타입 탐지
    let deviceType: ClientInfo['client']['deviceType'] = 'desktop';
    let device = null;
    
    if (ua.includes('mobile')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    } else if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider')) {
      deviceType = 'bot';
    }

    if (ua.includes('iphone')) device = 'iPhone';
    else if (ua.includes('ipad')) device = 'iPad';
    else if (ua.includes('android')) device = 'Android Device';

    return {
      browser,
      browserVersion,
      os,
      osVersion,
      device,
      deviceType,
    };
  }

  /**
   * 봇/크롤러 탐지
   */
  private detectBot(userAgent: string): { isBot: boolean; isCrawler: boolean } {
    const ua = userAgent.toLowerCase();
    
    const botPatterns = [
      'bot', 'crawl', 'spider', 'scrape', 'fetch',
      'python', 'java', 'ruby', 'perl', 'php',
      'curl', 'wget', 'axios', 'httpie',
      'postman', 'insomnia', 'thunder client',
    ];

    const crawlerPatterns = [
      'googlebot', 'bingbot', 'slurp', 'duckduckbot',
      'baiduspider', 'yandexbot', 'facebookexternalhit',
      'twitterbot', 'linkedinbot', 'whatsapp', 'telegram',
    ];

    const isBot = botPatterns.some(pattern => ua.includes(pattern));
    const isCrawler = crawlerPatterns.some(pattern => ua.includes(pattern));

    return { isBot: isBot || isCrawler, isCrawler };
  }

  /**
   * 네트워크 정보
   */
  private async getNetworkInfo(request: Request, ip: string): Promise<ClientInfo['network']> {
    let hostname = null;
    
    try {
      // Reverse DNS lookup
      const hostnames = await reverseLookup(ip);
      hostname = hostnames?.[0] || null;
    } catch (error) {
      // Reverse DNS가 실패하는 것은 일반적임
      this.logger.debug(`Reverse DNS lookup failed for ${ip}`);
    }

    return {
      hostname,
      port: request.socket?.remotePort || null,
      protocol: request.protocol,
      secure: request.secure,
      connectionType: request.headers['connection'] as string || null,
    };
  }

  /**
   * 헤더 분석
   */
  private analyzeHeaders(request: Request): ClientInfo['headers'] {
    const allHeaders = { ...request.headers };
    
    // 의심스러운 헤더
    const suspiciousHeaders = [];
    const suspiciousPatterns = [
      'x-forwarded', 'proxy', 'via', 'x-real-ip',
      'x-originating-ip', 'x-remote-ip', 'x-client-ip',
      'x-bluecoat', 'x-squid', 'x-akamai',
    ];

    for (const header of Object.keys(allHeaders)) {
      if (suspiciousPatterns.some(pattern => header.toLowerCase().includes(pattern))) {
        suspiciousHeaders.push(header);
      }
    }

    // 일반적으로 있어야 할 헤더 체크
    const expectedHeaders = [
      'user-agent', 'accept', 'accept-language',
      'accept-encoding', 'connection',
    ];

    const missingHeaders = expectedHeaders.filter(
      header => !request.headers[header]
    );

    return {
      all: allHeaders as Record<string, string | string[]>,
      suspicious: suspiciousHeaders,
      missing: missingHeaders,
    };
  }

  /**
   * 보안 정보 분석
   */
  private analyzeSecurityInfo(
    request: Request,
    proxyInfo: ClientInfo['proxy'],
    vpnInfo: { isVpn: boolean; isTor: boolean }
  ): ClientInfo['security'] {
    const threats = [];
    const recommendations = [];
    
    // 위험 점수 계산 (0-100)
    let riskScore = 0;

    // 프록시 사용
    if (proxyInfo.detected) {
      threats.push('Proxy detected');
      riskScore += 20;
      if (proxyInfo.suspicionLevel === 'high') {
        riskScore += 15;
      }
    }

    // VPN 사용
    if (vpnInfo.isVpn) {
      threats.push('VPN connection detected');
      riskScore += 15;
    }

    // Tor 사용
    if (vpnInfo.isTor) {
      threats.push('Tor network detected');
      riskScore += 30;
      recommendations.push('Consider blocking Tor exit nodes');
    }

    // User-Agent 없음
    if (!request.headers['user-agent']) {
      threats.push('Missing User-Agent');
      riskScore += 10;
      recommendations.push('Require User-Agent header');
    }

    // 의심스러운 헤더
    if (proxyInfo.indicators.length > 3) {
      threats.push('Multiple proxy indicators');
      riskScore += 10;
    }

    // TLS 정보 (HTTPS인 경우)
    const tlsSocket = request.socket as any;
    const tlsVersion = tlsSocket.getCipher?.()?.version || null;
    const cipher = tlsSocket.getCipher?.()?.name || null;

    // 보안 권장사항
    if (riskScore > 50) {
      recommendations.push('Implement additional verification');
      recommendations.push('Consider rate limiting');
    }

    if (riskScore > 70) {
      recommendations.push('Manual review recommended');
      recommendations.push('Consider blocking this IP');
    }

    // Fingerprint 생성
    const fingerprint = this.generateFingerprint(request);

    return {
      tlsVersion,
      cipher,
      fingerprint,
      riskScore: Math.min(100, riskScore),
      threats,
      recommendations,
    };
  }

  /**
   * 기술 스택 정보
   */
  private extractTechnologyInfo(request: Request): ClientInfo['technology'] {
    // 서버 사이드에서는 제한적인 정보만 얻을 수 있음
    // 완전한 정보는 클라이언트 사이드 JavaScript가 필요
    
    const acceptLanguage = request.headers['accept-language'] || '';
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang?.split(';')[0]?.trim())
      .filter((lang): lang is string => Boolean(lang));

    return {
      javascript: false, // 클라이언트 사이드에서 확인 필요
      cookies: !!request.headers.cookie,
      webrtc: false, // 클라이언트 사이드에서 확인 필요
      canvas: false, // 클라이언트 사이드에서 확인 필요
      webgl: false, // 클라이언트 사이드에서 확인 필요
      timezone: null, // 클라이언트 사이드에서 확인 필요
      screen: {
        width: null,
        height: null,
        colorDepth: null,
      },
      languages,
      plugins: [], // 클라이언트 사이드에서 확인 필요
    };
  }

  /**
   * IP 타입 확인
   */
  private getIpType(ip: string): 'IPv4' | 'IPv6' | 'Unknown' {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return 'IPv4';
    } else if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip)) {
      return 'IPv6';
    }
    return 'Unknown';
  }

  /**
   * Private IP 확인
   */
  private isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,                      // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,                // 192.168.0.0/16
      /^127\./,                     // 127.0.0.0/8 (loopback)
      /^169\.254\./,                // 169.254.0.0/16 (link-local)
      /^::1$/,                      // IPv6 loopback
      /^fe80:/,                     // IPv6 link-local
      /^fc00:/,                     // IPv6 unique local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * IP 유효성 검사
   */
  private isValidIp(ip: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (ipv4Pattern.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Pattern.test(ip);
  }

  /**
   * 디지털 지문 생성
   */
  private generateFingerprint(request: Request): string {
    const components = [
      this.getClientIp(request),
      request.headers['user-agent'] || '',
      request.headers['accept'] || '',
      request.headers['accept-language'] || '',
      request.headers['accept-encoding'] || '',
      request.headers['connection'] || '',
    ];

    // 간단한 해시 생성 (실제로는 crypto 모듈 사용 권장)
    const data = components.join('|');
    return Buffer.from(data).toString('base64').substring(0, 32);
  }
}
