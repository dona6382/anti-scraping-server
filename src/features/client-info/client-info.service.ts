import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RequestUtils } from '../../common/utils/request.utils';
import { ExtendedRequest } from '../../core/types';

/**
 * 클라이언트 정보 인터페이스
 */
export interface ClientInfo {
  ip: {
    address: string;
    type: 'IPv4' | 'IPv6' | 'Unknown';
    isPrivate: boolean;
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
  };
  
  proxy: {
    detected: boolean;
    type: string | null;
    headers: Record<string, string>;
    suspicionLevel: 'none' | 'low' | 'medium' | 'high';
    indicators: string[];
  };
  
  location: {
    country: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
    isp: string | null;
  };
  
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
  
  network: {
    hostname: string | null;
    port: number | null;
    protocol: string;
    secure: boolean;
  };
  
  headers: {
    all: Record<string, string | string[]>;
    suspicious: string[];
    missing: string[];
  };
  
  security: {
    riskScore: number; // 0-100
    threats: string[];
    recommendations: string[];
  };
}

/**
 * Client Information Service
 * 클라이언트의 다양한 정보를 수집하고 분석하는 서비스
 */
@Injectable()
export class ClientInfoService {
  constructor() {}

  /**
   * 전체 클라이언트 정보 수집
   */
  async getClientInfo(request: Request): Promise<ClientInfo> {
    const ip = RequestUtils.extractClientIp(request as ExtendedRequest);
    const userAgent = RequestUtils.extractUserAgent(request as ExtendedRequest);
    
    return {
      ip: this.analyzeIp(ip),
      proxy: this.detectProxy(request),
      location: await this.getLocationInfo(ip),
      client: this.analyzeClient(userAgent),
      network: this.analyzeNetwork(request),
      headers: this.analyzeHeaders(request),
      security: this.calculateSecurityScore(request),
    };
  }

  /**
   * IP 분석
   */
  private analyzeIp(ip: string): ClientInfo['ip'] {
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isIPv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
    const isPrivate = RequestUtils.isPrivateIp(ip);

    return {
      address: ip,
      type: isIPv4 ? 'IPv4' : isIPv6 ? 'IPv6' : 'Unknown',
      isPrivate,
      isProxy: this.isDatacenterIp(ip),
      isVpn: this.isKnownVpnRange(ip),
      isTor: false, // Tor exit node 목록은 별도 업데이트 필요
    };
  }

  /**
   * 알려진 데이터센터/클라우드 IP 대역 탐지
   */
  private isDatacenterIp(ip: string): boolean {
    const datacenterRanges = [
      /^13\.(52|56|57|250|251)\./,    // AWS
      /^18\.(144|188|216|236)\./,     // AWS
      /^34\.(8[0-9]|9[0-9]|1[0-6][0-9])\./,  // GCP
      /^35\.(1[5-9][0-9]|2[0-4][0-9])\./,    // GCP
      /^104\.(1[6-9]|2[0-9]|3[0-1])\./,      // DigitalOcean
      /^159\.(65|89|203)\./,          // DigitalOcean
      /^167\.(71|172|99)\./,          // DigitalOcean
      /^64\.225\./,                   // DigitalOcean
      /^5\.161\./,                    // Hetzner
      /^49\.12\./,                    // Hetzner
      /^135\.181\./,                  // Hetzner
      /^23\.(88|92|94|95|96)\./,      // Hetzner
      /^45\.(33|56|79)\./,           // Linode
      /^172\.(104|105)\./,           // Linode
      /^139\.(162)\./,               // Linode
      /^51\.(38|77|79|83|89|91)\./,  // OVH
      /^198\.211\./,                  // Vultr
      /^45\.(32|63|76|77)\./,        // Vultr
    ];

    return datacenterRanges.some(range => range.test(ip));
  }

  /**
   * 알려진 VPN 서비스 IP 대역
   */
  private isKnownVpnRange(ip: string): boolean {
    const vpnRanges = [
      /^185\.156\.(4[0-7])\./,       // NordVPN
      /^146\.70\./,                   // Mullvad
      /^193\.138\.(218|219)\./,       // ProtonVPN
      /^103\.(86|231)\./,             // ExpressVPN
      /^91\.108\./,                   // Surfshark
    ];

    return vpnRanges.some(range => range.test(ip));
  }

  /**
   * 프록시 탐지
   */
  private detectProxy(request: Request): ClientInfo['proxy'] {
    const proxyHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-proxy-id',
      'x-forwarded-proto',
      'forwarded',
      'via',
    ];
    
    const detectedHeaders: Record<string, string> = {};
    const indicators: string[] = [];
    
    proxyHeaders.forEach(header => {
      const value = request.headers[header];
      if (value) {
        detectedHeaders[header] = Array.isArray(value) ? value.join(', ') : value;
        indicators.push(header);
      }
    });
    
    const detected = indicators.length > 0;
    const suspicionLevel = detected 
      ? indicators.length > 2 ? 'high' : 'medium'
      : 'none';
    
    return {
      detected,
      type: detected ? 'HTTP_PROXY' : null,
      headers: detectedHeaders,
      suspicionLevel,
      indicators,
    };
  }

  /**
   * 위치 정보 (실제 구현에서는 IP 지리 정보 API 사용)
   */
  private async getLocationInfo(ip: string): Promise<ClientInfo['location']> {
    // private IP는 GeoIP 조회 불가
    if (RequestUtils.isPrivateIp(ip) || ip === 'unknown') {
      return { country: null, countryCode: null, region: null, city: null, isp: null };
    }

    try {
      // ip-api.com (무료, 분당 45회 제한)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city,isp,status`);
      if (!response.ok) {
        return { country: null, countryCode: null, region: null, city: null, isp: null };
      }
      const data = await response.json();
      if (data.status !== 'success') {
        return { country: null, countryCode: null, region: null, city: null, isp: null };
      }

      return {
        country: data.country ?? null,
        countryCode: data.countryCode ?? null,
        region: data.regionName ?? null,
        city: data.city ?? null,
        isp: data.isp ?? null,
      };
    } catch {
      return { country: null, countryCode: null, region: null, city: null, isp: null };
    }
  }

  /**
   * 클라이언트 분석
   */
  private analyzeClient(userAgent: string): ClientInfo['client'] {
    const isBot = RequestUtils.isBotUserAgent(userAgent);
    const isCrawler = RequestUtils.isCrawlerUserAgent(userAgent);
    const deviceType = RequestUtils.detectDeviceType(userAgent);
    
    return {
      userAgent,
      browser: this.extractBrowser(userAgent),
      browserVersion: this.extractBrowserVersion(userAgent),
      os: this.extractOS(userAgent),
      osVersion: null,
      device: null,
      deviceType,
      isBot,
      isCrawler,
    };
  }

  /**
   * 네트워크 분석
   */
  private analyzeNetwork(request: Request): ClientInfo['network'] {
    return {
      hostname: request.hostname || null,
      port: null,
      protocol: request.protocol || 'http',
      secure: request.secure || false,
    };
  }

  /**
   * 헤더 분석
   */
  private analyzeHeaders(request: Request): ClientInfo['headers'] {
    const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-real-ip', 'x-forwarded-for'];
    const suspiciousHeaders: string[] = [];
    const requiredHeaders = ['accept', 'accept-language', 'user-agent'];
    const missing = requiredHeaders.filter(header => !request.headers[header]);

    // 의심스러운 헤더 패턴 확인
    Object.keys(request.headers).forEach(header => {
      const value = request.headers[header];
      if (typeof value === 'string' && value.includes('bot')) {
        suspiciousHeaders.push(header);
      }
    });

    const filteredHeaders = Object.fromEntries(
      Object.entries(request.headers).filter(([key]) => !SENSITIVE_HEADERS.includes(key.toLowerCase()))
    );

    return {
      all: filteredHeaders as Record<string, string | string[]>,
      suspicious: suspiciousHeaders,
      missing,
    };
  }

  /**
   * 보안 점수 계산
   */
  private calculateSecurityScore(request: Request): ClientInfo['security'] {
    let riskScore = 0;
    const threats: string[] = [];
    const recommendations: string[] = [];
    
    const userAgent = RequestUtils.extractUserAgent(request as ExtendedRequest);
    
    // User-Agent 기반 위험도
    if (!userAgent) {
      riskScore += 30;
      threats.push('Missing User-Agent');
      recommendations.push('Provide valid User-Agent header');
    } else if (RequestUtils.isBotUserAgent(userAgent)) {
      riskScore += 50;
      threats.push('Bot User-Agent detected');
    }
    
    // 헤더 기반 위험도
    const requiredHeaders = ['accept', 'accept-language'];
    const missingHeaders = requiredHeaders.filter(header => !request.headers[header]);
    riskScore += missingHeaders.length * 10;
    
    if (missingHeaders.length > 0) {
      threats.push(`Missing headers: ${missingHeaders.join(', ')}`);
      recommendations.push('Include standard browser headers');
    }
    
    return {
      riskScore: Math.min(riskScore, 100),
      threats,
      recommendations,
    };
  }

  /**
   * 브라우저 추출
   */
  private extractBrowser(userAgent: string): string | null {
    const browsers = [
      { name: 'Chrome', pattern: /Chrome\/(\d+)/ },
      { name: 'Firefox', pattern: /Firefox\/(\d+)/ },
      { name: 'Safari', pattern: /Safari\/(\d+)/ },
      { name: 'Edge', pattern: /Edge\/(\d+)/ },
      { name: 'Opera', pattern: /Opera\/(\d+)/ },
    ];

    for (const browser of browsers) {
      if (browser.pattern.test(userAgent)) {
        return browser.name;
      }
    }

    return null;
  }

  /**
   * 브라우저 버전 추출
   */
  private extractBrowserVersion(userAgent: string): string | null {
    const versionPatterns = [
      /Chrome\/(\d+\.\d+)/,
      /Firefox\/(\d+\.\d+)/,
      /Safari\/(\d+\.\d+)/,
      /Edge\/(\d+\.\d+)/,
      /Opera\/(\d+\.\d+)/,
    ];

    for (const pattern of versionPatterns) {
      const match = userAgent.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * OS 추출
   */
  private extractOS(userAgent: string): string | null {
    const osPatterns = [
      { name: 'Windows', pattern: /Windows NT (\d+\.\d+)/ },
      { name: 'macOS', pattern: /Mac OS X (\d+[._]\d+)/ },
      { name: 'Linux', pattern: /Linux/ },
      { name: 'Android', pattern: /Android (\d+\.\d+)/ },
      { name: 'iOS', pattern: /OS (\d+_\d+)/ },
    ];

    for (const os of osPatterns) {
      if (os.pattern.test(userAgent)) {
        return os.name;
      }
    }

    return null;
  }
}
