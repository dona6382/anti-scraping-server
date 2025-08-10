import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICacheService } from './base-cache.service';
import { ConfigurationService } from '../../modules/configuration/configuration.service';

/**
 * Blacklist Entry Interface
 */
export interface BlacklistEntry {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  count: number;
}

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
    private readonly configService: ConfigurationService,
  ) {
    this.ttl = this.configService.app.ipBlacklist.ttl;
    this.logger.log(`Initialized with TTL: ${this.ttl} seconds`);
  }

  /**
   * IP 차단 (별칭 추가)
   */
  async blockIp(ip: string, reason: string, ttl?: number): Promise<void> {
    return this.blacklistIp(ip, reason, ttl);
  }

  /**
   * IP 차단
   */
  async blacklistIp(ip: string, reason: string, ttl?: number): Promise<void> {
    const key = this.getKey(ip);
    const existingEntry = await this.cache.get<BlacklistEntry>(key);
    
    const entry: BlacklistEntry = {
      ip,
      reason,
      blockedAt: new Date(),
      expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : undefined,
      count: existingEntry ? existingEntry.count + 1 : 1,
    };
    
    await this.cache.set(key, entry, ttl || this.ttl);
    
    this.logger.warn(`Blocked IP: ${ip}, Reason: ${reason}, Count: ${entry.count}`);
  }

  /**
   * IP 차단 해제 (별칭 추가)
   */
  async unblockIp(ip: string): Promise<void> {
    return this.removeFromBlacklist(ip);
  }

  /**
   * IP 차단 해제
   */
  async removeFromBlacklist(ip: string): Promise<void> {
    const key = this.getKey(ip);
    await this.cache.delete(key);
    this.logger.log(`Unblocked IP: ${ip}`);
  }

  /**
   * IP 차단 여부 확인 (별칭 추가)
   */
  async isBlocked(ip: string): Promise<boolean> {
    return this.isBlacklisted(ip);
  }

  /**
   * IP 차단 여부 확인
   */
  async isBlacklisted(ip: string): Promise<boolean> {
    const key = this.getKey(ip);
    const entry = await this.cache.get<BlacklistEntry>(key);
    
    if (!entry) {
      return false;
    }
    
    // 만료 시간 확인
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      await this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 차단 이유 조회
   */
  async getBlockReason(ip: string): Promise<string | null> {
    const key = this.getKey(ip);
    const entry = await this.cache.get<BlacklistEntry>(key);
    return entry ? entry.reason : null;
  }

  /**
   * 차단 정보 조회 (별칭 추가)
   */
  async getBlockInfo(ip: string): Promise<BlacklistEntry | null> {
    return this.getIpInfo(ip);
  }

  /**
   * IP 정보 조회
   */
  async getIpInfo(ip: string): Promise<BlacklistEntry | null> {
    const key = this.getKey(ip);
    return await this.cache.get<BlacklistEntry>(key);
  }

  /**
   * 모든 차단된 IP 조회 (별칭 추가)
   */
  async getAllBlockedIps(): Promise<BlacklistEntry[]> {
    return this.getAllBlacklistedIps();
  }

  /**
   * 모든 차단된 IP 조회
   */
  async getAllBlacklistedIps(): Promise<BlacklistEntry[]> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.cache.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }
    
    const entries = await this.cache.getMany<BlacklistEntry>(keys);
    return entries.filter((entry): entry is BlacklistEntry => entry !== null);
  }

  /**
   * 차단 목록 초기화
   */
  async clearAll(): Promise<void> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.cache.keys(pattern);
    
    if (keys.length > 0) {
      await this.cache.deleteMany(keys);
      this.logger.log(`Cleared ${keys.length} blocked IPs`);
    }
  }

  /**
   * 통계 조회 (별칭 추가)
   */
  async getStats(): Promise<{
    totalBlocked: number;
    recentBlocks: number;
    topReasons: Record<string, number>;
  }> {
    return this.getStatistics();
  }

  /**
   * 통계 조회
   */
  async getStatistics(): Promise<{
    totalBlocked: number;
    recentBlocks: number;
    topReasons: Record<string, number>;
    redisConnected?: boolean;
  }> {
    const entries = await this.getAllBlockedIps();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentBlocks = entries.filter(
      (entry) => new Date(entry.blockedAt) > oneHourAgo
    ).length;
    
    const reasonCounts: Record<string, number> = {};
    entries.forEach((entry) => {
      reasonCounts[entry.reason] = (reasonCounts[entry.reason] || 0) + 1;
    });
    
    return {
      totalBlocked: entries.length,
      recentBlocks,
      topReasons: reasonCounts,
      redisConnected: true, // Redis 또는 메모리 캐시가 항상 작동
    };
  }

  /**
   * 자동 차단 (rate limiting 등과 연동)
   */
  async autoBlock(ip: string, violations: string[]): Promise<void> {
    const reason = `Auto-blocked: ${violations.join(', ')}`;
    
    // 위반 횟수에 따라 차단 시간 증가
    const blockInfo = await this.getBlockInfo(ip);
    const count = blockInfo ? blockInfo.count + 1 : 1;
    const ttl = this.calculateBlockDuration(count);
    
    await this.blockIp(ip, reason, ttl);
  }

  /**
   * 차단 시간 계산 (지수적 증가)
   */
  private calculateBlockDuration(violationCount: number): number {
    const baseTtl = this.ttl;
    const multiplier = Math.min(Math.pow(2, violationCount - 1), 128); // 최대 128배
    return baseTtl * multiplier;
  }

  /**
   * 캐시 키 생성
   */
  private getKey(ip: string): string {
    // IP 주소 정규화
    const normalizedIp = ip.trim().toLowerCase();
    return `${this.keyPrefix}:${normalizedIp}`;
  }

  /**
   * IP 주소 유효성 검사
   */
  isValidIp(ip: string): boolean {
    // IPv4 패턴
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 패턴 (간단한 버전)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Pattern.test(ip)) {
      // IPv4 범위 확인
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Pattern.test(ip);
  }

  /**
   * CIDR 범위 차단 (예: 192.168.1.0/24)
   */
  async blockCidr(cidr: string, reason: string, ttl?: number): Promise<void> {
    // CIDR 파싱 및 범위 내 모든 IP 차단
    // 실제 구현은 더 복잡하지만, 기본 개념만 표시
    this.logger.warn(`CIDR blocking not fully implemented: ${cidr}`);
    
    // 간단한 구현 예시 (실제로는 더 정교한 로직 필요)
    const [baseIp, mask] = cidr.split('/');
    if (baseIp && mask) {
      await this.blockIp(cidr, `CIDR: ${reason}`, ttl);
    }
  }
}
