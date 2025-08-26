import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../../core/config/config.service';

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
  private readonly logger = new Logger(ClientInfoService.name);

  constructor(private readonly configService: AppConfigService) {}

  /**
   * 전체 클라이언트 정보 수집
   */
  async getClientInfo(request: Request): Promise<ClientInfo> {
    const ip = this.extractClientIp(request);
    const userAgent = this.extractUserAgent(request);
    
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
   * IP 주소 추출
   */
  private extractClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const cfConnectingIp = request.headers['cf-connecting-ip'] as string;
    
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    if (realIp) {
      return realIp;
    }
    if (cfConnectingIp) {
      return cfConnectingIp;
    }
    
    return request.socket?.remoteAddress || request.ip || 'unknown';
  }

  /**
   * User-Agent 추출
   */
  private extractUserAgent(request: Request): string {
    return (request.headers['user-agent'] as string) || '';
  }

  /**
   * IP 분석
   */
  private analyzeIp(ip: string): ClientInfo['ip'] {
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isIPv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
    
    const isPrivate = this.isPrivateIp(ip);
    
    return {
      address: ip,
      type: isIPv4 ? 'IPv4' : isIPv6 ? 'IPv6' : 'Unknown',
      isPrivate,
      isProxy: false, // 실제 구현에서는 IP 데이터베이스 사용
      isVpn: false,   // 실제 구현에서는 VPN 탐지 API 사용
      isTor: false,   // 실제 구현에서는 Tor 노드 리스트 확인
    };
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
    // 임시로 기본값 반환
    return {
      country: null,
      countryCode: null,
      region: null,
      city: null,
      isp: null,
    };
  }

  /**
   * 클라이언트 분석
   */
  private analyzeClient(userAgent: string): ClientInfo['client'] {
    const isBot = this.isBotUserAgent(userAgent);
    const isCrawler = this.isCrawlerUserAgent(userAgent);
    const deviceType = this.detectDeviceType(userAgent);
    
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
    
    return {
      all: request.headers,
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
    
    const userAgent = this.extractUserAgent(request);
    
    // User-Agent 기반 위험도
    if (!userAgent) {
      riskScore += 30;
      threats.push('Missing User-Agent');
      recommendations.push('Provide valid User-Agent header');
    } else if (this.isBotUserAgent(userAgent)) {
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
   * 프라이빗 IP 확인
   */
  private isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * 봇 User-Agent 확인
   */
  private isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /ruby/i,
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * 크롤러 User-Agent 확인
   */
  private isCrawlerUserAgent(userAgent: string): boolean {
    const crawlerPatterns = [
      /crawl/i,
      /spider/i,
      /scrape/i,
      /harvest/i,
      /extract/i,
    ];

    return crawlerPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * 디바이스 타입 탐지
   */
  private detectDeviceType(userAgent: string): ClientInfo['client']['deviceType'] {
    if (this.isBotUserAgent(userAgent)) {
      return 'bot';
    }

    const mobilePatterns = [
      /mobile/i,
      /android/i,
      /iphone/i,
      /blackberry/i,
      /windows phone/i,
    ];

    const tabletPatterns = [
      /tablet/i,
      /ipad/i,
    ];

    if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
      return 'mobile';
    }

    if (tabletPatterns.some(pattern => pattern.test(userAgent))) {
      return 'tablet';
    }

    return 'desktop';
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
