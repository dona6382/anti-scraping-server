import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Security Service Base
 * 모든 보안 서비스의 공통 기능
 */
@Injectable()
export abstract class SecurityServiceBase {
  protected readonly isDevelopment: boolean;
  protected readonly isProduction: boolean;
  protected readonly strictMode: boolean;

  constructor(protected readonly configService: ConfigService) {
    this.isDevelopment = configService.get('NODE_ENV', 'development') === 'development';
    this.isProduction = configService.get('NODE_ENV') === 'production';
    this.strictMode = configService.get('SECURITY_STRICT_MODE', 'false') === 'true';
  }

  /**
   * IP 주소 유효성 검사 (공통 로직)
   */
  protected isValidIpAddress(ip: string): boolean {
    if (!ip || ip === 'unknown') {
      return false;
    }

    // IPv4 패턴
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6 패턴
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Regex.test(ip);
  }

  /**
   * 프라이빗 IP 확인 (공통 로직)
   */
  protected isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * 설정 값 안전하게 가져오기
   */
  protected getConfig<T>(key: string, defaultValue: T): T {
    return this.configService.get<T>(key, defaultValue);
  }

  /**
   * 배열 설정 값 가져오기
   */
  protected getArrayConfig(key: string, separator: string = ','): string[] {
    const value = this.configService.get<string>(key, '');
    return value
      .split(separator)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * 숫자 설정 값 가져오기
   */
  protected getNumberConfig(key: string, defaultValue: number): number {
    const value = this.configService.get<string>(key);
    const parsed = value ? parseInt(value, 10) : NaN;
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Boolean 설정 값 가져오기
   */
  protected getBooleanConfig(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }
}

/**
 * Service Factory
 * 서비스 인스턴스를 중앙에서 관리
 */
@Injectable()
export class ServiceFactory {
  private readonly services = new Map<string, any>();

  /**
   * 서비스 등록
   */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  /**
   * 서비스 가져오기
   */
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /**
   * 서비스 존재 여부
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * 모든 서비스 이름
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 서비스 제거
   */
  unregister(name: string): boolean {
    return this.services.delete(name);
  }

  /**
   * 모든 서비스 제거
   */
  clear(): void {
    this.services.clear();
  }
}
