import { Injectable, Inject, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../core/config/config.service';
import { ICacheService } from './cache.service';
import { BlacklistEntry, SecurityReason, IpStatistics } from '../../../core/types';

/**
 * IP Blacklist Service
 * IP 차단 목록을 관리하는 서비스
 */
@Injectable()
export class IpBlacklistService {
  private readonly logger = new Logger(IpBlacklistService.name);
  private readonly ttl: number;
  private readonly keyPrefix = 'blacklist';

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly configService: AppConfigService,
  ) {
    this.ttl = this.configService.ipBlacklistConfig.ttl;
    this.logger.log(`Initialized with TTL: ${this.ttl} seconds`);
  }

  /**
   * IP 차단
   */
  async blockIp(ip: string, reason: SecurityReason, ttl?: number): Promise<void> {
    const key = this.getKey(ip);
    const existingEntry = await this.cache.get<BlacklistEntry>(key);
    
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : undefined;
    const entry: BlacklistEntry = {
      ip,
      reason,
      blockedAt: new Date(),
      ...(expiresAt && { expiresAt }),
      count: existingEntry ? existingEntry.count + 1 : 1,
    };
    
    await this.cache.set(key, entry, ttl || this.ttl);
    
    this.logger.warn(`Blocked IP: ${ip}, Reason: ${reason}, Count: ${entry.count}`);
  }

  /**
   * IP 차단 해제
   */
  async unblockIp(ip: string): Promise<void> {
    const key = this.getKey(ip);
    await this.cache.delete(key);
    this.logger.log(`Unblocked IP: ${ip}`);
  }

  /**
   * IP 차단 여부 확인
   */
  async isBlocked(ip: string): Promise<boolean> {
    const key = this.getKey(ip);
    return this.cache.exists(key);
  }

  /**
   * 차단 정보 조회
   */
  async getBlockInfo(ip: string): Promise<BlacklistEntry | null> {
    const key = this.getKey(ip);
    return this.cache.get<BlacklistEntry>(key);
  }

  /**
   * 차단 이유 조회
   */
  async getBlockReason(ip: string): Promise<string | null> {
    const info = await this.getBlockInfo(ip);
    return info ? info.reason : null;
  }

  /**
   * 모든 차단된 IP 조회
   */
  async getAllBlockedIps(): Promise<string[]> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.cache.keys(pattern);
    
    return keys.map(key => key.replace(`${this.keyPrefix}:`, ''));
  }

  /**
   * 차단 목록 조회 (상세 정보 포함)
   */
  async getBlocklist(): Promise<BlacklistEntry[]> {
    const ips = await this.getAllBlockedIps();
    const entries: BlacklistEntry[] = [];
    
    for (const ip of ips) {
      const entry = await this.getBlockInfo(ip);
      if (entry) {
        entries.push(entry);
      }
    }
    
    return entries;
  }

  /**
   * 통계 조회
   */
  async getStatistics(): Promise<IpStatistics> {
    const entries = await this.getBlocklist();
    const now = Date.now();
    const dayAgo = now - 86400000; // 24시간 전
    
    const recentBlocks = entries.filter(
      entry => entry.blockedAt.getTime() > dayAgo
    ).length;
    
    const topReasons: Record<string, number> = {};
    entries.forEach(entry => {
      topReasons[entry.reason] = (topReasons[entry.reason] || 0) + 1;
    });
    
    // Redis 연결 상태 확인
    const redisConnected = await this.isRedisConnected();
    
    return {
      totalBlocked: entries.length,
      recentBlocks,
      topReasons,
      redisConnected,
    };
  }

  /**
   * IP 유효성 검사
   */
  isValidIp(ip: string): boolean {
    // IPv4 패턴
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6 패턴 (간단한 검증)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Regex.test(ip);
  }

  /**
   * Redis 연결 상태 확인
   */
  private async isRedisConnected(): Promise<boolean> {
    try {
      const testKey = '__redis_connection_test__';
      await this.cache.set(testKey, true, 1);
      await this.cache.delete(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 키 생성
   */
  private getKey(ip: string): string {
    return `${this.keyPrefix}:${ip}`;
  }
}
