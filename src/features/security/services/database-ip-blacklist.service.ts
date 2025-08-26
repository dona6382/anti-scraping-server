import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IpBlacklist, SecurityEvent } from '../../../core/database/entities';
import { SecurityReason } from '../../../core/types';
import { AppConfigService } from '../../../core/config/config.service';

/**
 * Database IP Blacklist Service
 * 데이터베이스 기반 IP 차단 관리
 */
@Injectable()
export class DatabaseIpBlacklistService {
  private readonly logger = new Logger(DatabaseIpBlacklistService.name);

  constructor(
    @InjectRepository(IpBlacklist)
    private readonly ipBlacklistRepository: Repository<IpBlacklist>,
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
    private readonly configService: AppConfigService,
  ) {}

  /**
   * IP 차단
   */
  async blockIp(
    ip: string, 
    reason: SecurityReason, 
    ttl?: number, 
    description?: string,
    blockedByUserId?: string
  ): Promise<IpBlacklist> {
    // 기존 차단 기록 확인
    let existingBlock = await this.ipBlacklistRepository.findOne({
      where: { ip, isActive: true }
    });

    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : undefined;

    if (existingBlock) {
      // 기존 차단 기록 업데이트
      existingBlock.violationCount += 1;
      existingBlock.reason = reason;
      existingBlock.description = description;
      existingBlock.expiresAt = expiresAt;
      existingBlock.updatedAt = new Date();
      
      await this.ipBlacklistRepository.save(existingBlock);
      
      this.logger.warn(`Updated IP block: ${ip}, violations: ${existingBlock.violationCount}`);
      
      return existingBlock;
    } else {
      // 새로운 차단 기록 생성
      const newBlock = this.ipBlacklistRepository.create({
        ip,
        reason,
        description,
        expiresAt,
        violationCount: 1,
        isActive: true,
        blockedByUserId,
      });

      const savedBlock = await this.ipBlacklistRepository.save(newBlock);
      
      this.logger.warn(`Blocked IP: ${ip}, Reason: ${reason}`);
      
      // 보안 이벤트 로깅
      await this.logSecurityEvent('IP_BLOCKED', 'HIGH', ip, {
        reason,
        description,
        ttl,
        blockedByUserId,
      });
      
      return savedBlock;
    }
  }

  /**
   * IP 차단 해제
   */
  async unblockIp(ip: string, unblockedByUserId?: string): Promise<boolean> {
    const result = await this.ipBlacklistRepository.update(
      { ip, isActive: true },
      { 
        isActive: false,
        updatedAt: new Date(),
      }
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Unblocked IP: ${ip}`);
      
      // 보안 이벤트 로깅
      await this.logSecurityEvent('IP_UNBLOCKED', 'MEDIUM', ip, {
        unblockedByUserId,
      });
      
      return true;
    }

    return false;
  }

  /**
   * IP 차단 여부 확인
   */
  async isBlocked(ip: string): Promise<boolean> {
    const block = await this.ipBlacklistRepository.findOne({
      where: { 
        ip, 
        isActive: true 
      }
    });

    // 만료 확인
    if (block && block.expiresAt && block.expiresAt < new Date()) {
      // 만료된 차단 기록 비활성화
      await this.ipBlacklistRepository.update(block.id, { 
        isActive: false 
      });
      return false;
    }

    return !!block;
  }

  /**
   * 차단 정보 조회
   */
  async getBlockInfo(ip: string): Promise<IpBlacklist | null> {
    return await this.ipBlacklistRepository.findOne({
      where: { ip, isActive: true },
      relations: ['blockedBy'],
    });
  }

  /**
   * 차단 이유 조회
   */
  async getBlockReason(ip: string): Promise<string | null> {
    const info = await this.getBlockInfo(ip);
    return info ? info.reason : null;
  }

  /**
   * 모든 차단된 IP 조회 (페이지네이션)
   */
  async getAllBlockedIps(
    page: number = 1, 
    limit: number = 50,
    sortBy: 'createdAt' | 'violationCount' | 'ip' = 'createdAt'
  ): Promise<{
    ips: IpBlacklist[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [ips, total] = await this.ipBlacklistRepository.findAndCount({
      where: { isActive: true },
      order: { [sortBy]: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['blockedBy'],
    });

    return {
      ips,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 차단 통계 조회
   */
  async getStatistics(): Promise<{
    totalBlocked: number;
    recentBlocks: number;
    topReasons: Record<string, number>;
    violationDistribution: Record<string, number>;
  }> {
    const total = await this.ipBlacklistRepository.count({
      where: { isActive: true }
    });

    // 최근 24시간 차단
    const dayAgo = new Date(Date.now() - 86400000);
    const recent = await this.ipBlacklistRepository.count({
      where: { 
        isActive: true,
        createdAt: { $gte: dayAgo } as any
      }
    });

    // 차단 이유 분포
    const reasonStats = await this.ipBlacklistRepository
      .createQueryBuilder('ip_blacklist')
      .select('reason')
      .addSelect('COUNT(*)', 'count')
      .where('isActive = :active', { active: true })
      .groupBy('reason')
      .getRawMany();

    const topReasons: Record<string, number> = {};
    reasonStats.forEach(stat => {
      topReasons[stat.reason] = parseInt(stat.count);
    });

    // 위반 횟수 분포
    const violationStats = await this.ipBlacklistRepository
      .createQueryBuilder('ip_blacklist')
      .select('violation_count')
      .addSelect('COUNT(*)', 'count')
      .where('isActive = :active', { active: true })
      .groupBy('violation_count')
      .getRawMany();

    const violationDistribution: Record<string, number> = {};
    violationStats.forEach(stat => {
      const key = stat.violation_count === 1 ? '1' : stat.violation_count <= 5 ? '2-5' : '6+';
      violationDistribution[key] = (violationDistribution[key] || 0) + parseInt(stat.count);
    });

    return {
      totalBlocked: total,
      recentBlocks: recent,
      topReasons,
      violationDistribution,
    };
  }

  /**
   * 만료된 차단 기록 정리
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.ipBlacklistRepository.update(
      {
        isActive: true,
        expiresAt: { $lt: new Date() } as any
      },
      { 
        isActive: false,
        updatedAt: new Date(),
      }
    );

    const cleanedCount = result.affected || 0;
    
    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired IP blocks`);
    }

    return cleanedCount;
  }

  /**
   * 보안 이벤트 로깅
   */
  private async logSecurityEvent(
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    ip: string,
    eventData?: any
  ): Promise<void> {
    try {
      const event = this.securityEventRepository.create({
        eventType,
        severity,
        ip,
        description: `IP ${eventType.toLowerCase()}: ${ip}`,
        eventData,
      });

      await this.securityEventRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to log security event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * IP 유효성 검사
   */
  isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6 간단 검증
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Regex.test(ip);
  }
}
