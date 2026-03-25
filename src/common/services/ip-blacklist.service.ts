import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICacheService, BlacklistEntry, SecurityReason, IpStatistics } from '../../core/types';
import { AppConfigService } from '../../core/config/config.service';
import { RequestUtils } from '../utils/request.utils';

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
    
    this.logger.warn(`Blocked IP: ${RequestUtils.hashIp(ip, 'log')}, Reason: ${reason}, Count: ${entry.count}`);
  }

  /**
   * IP 차단 해제
   */
  async unblockIp(ip: string): Promise<void> {
    const key = this.getKey(ip);
    await this.cache.delete(key);
    this.logger.log(`Unblocked IP: ${RequestUtils.hashIp(ip, 'log')}`);
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
   * 차단 목록 조회 (상세 정보 포함)
   */
  async getBlocklist(): Promise<BlacklistEntry[]> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.cache.keys(pattern);

    if (keys.length === 0) return [];

    // Batch fetch로 N+1 쿼리 제거
    const entries = await this.cache.getMany<BlacklistEntry>(keys);
    return entries.filter((entry): entry is BlacklistEntry => entry !== null);
  }

  /**
   * 차단 목록 초기화
   */
  async clearBlocklist(): Promise<void> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.cache.keys(pattern);

    if (keys.length > 0) {
      await this.cache.deleteMany(keys);
    }

    this.logger.warn(`Cleared blacklist: ${keys.length} IPs removed`);
  }

  /**
   * 통계 조회
   */
  async getStatistics(): Promise<IpStatistics> {
    const entries = await this.getBlocklist();
    const now = Date.now();
    const dayAgo = now - 86400000; // 24시간 전
    
    const recentBlocks = entries.filter(
      entry => new Date(entry.blockedAt).getTime() > dayAgo
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
   * 만료된 항목 정리
   */
  async cleanupExpired(): Promise<number> {
    const entries = await this.getBlocklist();
    const now = new Date();
    let cleaned = 0;
    
    for (const entry of entries) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        await this.unblockIp(entry.ip);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired blacklist entries`);
    }
    
    return cleaned;
  }

  /**
   * IP 유효성 검사
   */
  isValidIp(ip: string): boolean {
    return RequestUtils.isValidIpAddress(ip);
  }

  /**
   * Redis 연결 상태 확인
   */
  async isRedisConnected(): Promise<boolean> {
    try {
      // cache service가 Redis를 사용하는지 확인
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
    return `${this.keyPrefix}:${RequestUtils.normalizeIp(ip)}`;
  }
}
