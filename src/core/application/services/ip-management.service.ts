import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  IIpValidationService,
  IpValidationResult,
  ICache,
  IEventPublisher,
  IMetricsCollector,
} from '../../domain/interfaces/security.interfaces';
import { IpAddress } from '../../domain/value-objects/ip-address.vo';
import { IpBlacklistedException } from '../../domain/exceptions/domain.exceptions';

/**
 * IP Information
 */
interface IpInfo {
  ip: string;
  blacklisted: boolean;
  reason?: string;
  blacklistedAt?: Date;
  expiresAt?: Date;
  attempts?: number;
  lastAttempt?: Date;
  metadata?: Record<string, any>;
}

/**
 * IP Blacklist Options
 */
interface BlacklistOptions {
  reason: string;
  ttl?: number;
  metadata?: Record<string, any>;
}

/**
 * IP Management Service
 * IP 블랙리스트/화이트리스트를 관리하는 서비스
 */
@Injectable()
export class IpManagementService implements IIpValidationService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpManagementService.name);
  private readonly memoryCache = new Map<string, IpInfo>();
  private cleanupInterval: NodeJS.Timeout;
  
  // Configuration
  private readonly config = {
    defaultTtl: 86400, // 24 hours
    cleanupIntervalMs: 60000, // 1 minute
    maxMemoryEntries: 10000,
    autoBlacklistThreshold: 10, // Auto-blacklist after 10 failed attempts
  };

  constructor(
    private readonly cache?: ICache<IpInfo>,
    private readonly eventPublisher?: IEventPublisher,
    private readonly metricsCollector?: IMetricsCollector,
  ) {}

  async onModuleInit(): Promise<void> {
    this.startCleanupTask();
    this.logger.log('IP Management Service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log('IP Management Service destroyed');
  }

  /**
   * Validate IP address
   */
  async validate(ip: string): Promise<IpValidationResult> {
    const ipAddress = new IpAddress(ip);
    
    // Check if private IP (always allowed)
    if (ipAddress.isPrivate()) {
      return {
        isValid: true,
        isBlacklisted: false,
        metadata: { private: true },
      };
    }

    // Check blacklist
    const info = await this.getIpInfo(ipAddress.toString());
    
    if (info?.blacklisted) {
      // Check if expired
      if (info.expiresAt && info.expiresAt < new Date()) {
        await this.removeFromBlacklist(ipAddress.toString());
        return {
          isValid: true,
          isBlacklisted: false,
          metadata: { expired: true },
        };
      }

      return {
        isValid: false,
        isBlacklisted: true,
        reason: info.reason,
        metadata: info.metadata,
      };
    }

    return {
      isValid: true,
      isBlacklisted: false,
    };
  }

  /**
   * Add IP to blacklist
   */
  async blacklist(ip: string, reason: string, ttl?: number): Promise<void> {
    const ipAddress = new IpAddress(ip);
    const expiresAt = ttl 
      ? new Date(Date.now() + ttl * 1000)
      : new Date(Date.now() + this.config.defaultTtl * 1000);

    const info: IpInfo = {
      ip: ipAddress.toString(),
      blacklisted: true,
      reason,
      blacklistedAt: new Date(),
      expiresAt,
    };

    // Save to cache
    await this.saveIpInfo(ipAddress.toString(), info, ttl);

    // Publish event
    this.eventPublisher?.publish('ip.blacklisted', {
      ip: ipAddress.toString(),
      reason,
      expiresAt,
    });

    // Record metrics
    this.metricsCollector?.increment('ip.blacklist.added', {
      reason: this.sanitizeMetricTag(reason),
    });

    this.logger.warn(`IP blacklisted: ${ipAddress.getMasked()}, Reason: ${reason}`);
  }

  /**
   * Remove IP from blacklist (whitelist)
   */
  async whitelist(ip: string): Promise<void> {
    const ipAddress = new IpAddress(ip);
    await this.removeFromBlacklist(ipAddress.toString());

    // Publish event
    this.eventPublisher?.publish('ip.whitelisted', {
      ip: ipAddress.toString(),
    });

    // Record metrics
    this.metricsCollector?.increment('ip.blacklist.removed');

    this.logger.log(`IP whitelisted: ${ipAddress.getMasked()}`);
  }

  /**
   * Check if IP is blacklisted
   */
  async isBlacklisted(ip: string): Promise<boolean> {
    const result = await this.validate(ip);
    return result.isBlacklisted;
  }

  /**
   * Get all blacklisted IPs
   */
  async getBlacklistedIps(): Promise<string[]> {
    const ips: Set<string> = new Set();

    // From memory cache
    for (const [ip, info] of this.memoryCache.entries()) {
      if (info.blacklisted) {
        // Check expiration
        if (!info.expiresAt || info.expiresAt > new Date()) {
          ips.add(ip);
        }
      }
    }

    // From external cache if available
    if (this.cache) {
      // This would require a scan operation which might not be available
      // in all cache implementations. For now, we'll just use memory cache.
    }

    return Array.from(ips);
  }

  /**
   * Record failed attempt for IP
   */
  async recordFailedAttempt(ip: string, reason: string): Promise<void> {
    const ipAddress = new IpAddress(ip);
    const info = await this.getIpInfo(ipAddress.toString()) || {
      ip: ipAddress.toString(),
      blacklisted: false,
      attempts: 0,
    };

    info.attempts = (info.attempts || 0) + 1;
    info.lastAttempt = new Date();

    // Auto-blacklist if threshold exceeded
    if (info.attempts >= this.config.autoBlacklistThreshold) {
      await this.blacklist(
        ipAddress.toString(),
        `Auto-blacklisted after ${info.attempts} failed attempts`,
        this.config.defaultTtl
      );
    } else {
      await this.saveIpInfo(ipAddress.toString(), info);
    }

    // Record metrics
    this.metricsCollector?.increment('ip.failed_attempts', {
      reason: this.sanitizeMetricTag(reason),
    });
  }

  /**
   * Get IP information
   */
  private async getIpInfo(ip: string): Promise<IpInfo | null> {
    // Check memory cache first
    const memoryInfo = this.memoryCache.get(ip);
    if (memoryInfo) {
      return memoryInfo;
    }

    // Check external cache
    if (this.cache) {
      const cacheKey = this.getCacheKey(ip);
      const info = await this.cache.get(cacheKey);
      if (info) {
        // Update memory cache
        this.memoryCache.set(ip, info);
        return info;
      }
    }

    return null;
  }

  /**
   * Save IP information
   */
  private async saveIpInfo(ip: string, info: IpInfo, ttl?: number): Promise<void> {
    // Save to memory cache
    this.memoryCache.set(ip, info);

    // Enforce memory limit
    if (this.memoryCache.size > this.config.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    // Save to external cache
    if (this.cache) {
      const cacheKey = this.getCacheKey(ip);
      await this.cache.set(cacheKey, info, ttl || this.config.defaultTtl);
    }
  }

  /**
   * Remove IP from blacklist
   */
  private async removeFromBlacklist(ip: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(ip);

    // Remove from external cache
    if (this.cache) {
      const cacheKey = this.getCacheKey(ip);
      await this.cache.delete(cacheKey);
    }
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    const toDelete: string[] = [];

    for (const [ip, info] of this.memoryCache.entries()) {
      if (info.expiresAt && info.expiresAt < now) {
        toDelete.push(ip);
      }
    }

    for (const ip of toDelete) {
      this.memoryCache.delete(ip);
      this.logger.debug(`Cleaned up expired IP: ${ip}`);
    }

    if (toDelete.length > 0) {
      this.metricsCollector?.gauge('ip.blacklist.size', this.memoryCache.size);
    }
  }

  /**
   * Get cache key for IP
   */
  private getCacheKey(ip: string): string {
    return `blacklist:ip:${ip}`;
  }

  /**
   * Sanitize tag for metrics
   */
  private sanitizeMetricTag(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 50);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<Record<string, any>> {
    const blacklistedIps = await this.getBlacklistedIps();
    
    return {
      totalBlacklisted: blacklistedIps.length,
      memoryEntries: this.memoryCache.size,
      cacheAvailable: !!this.cache,
    };
  }
}
