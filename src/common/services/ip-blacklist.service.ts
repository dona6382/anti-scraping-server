import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from './config.service';
import { createClient } from 'redis';
import { SECURITY_CONSTANTS } from '../constants/security.constants';
import { IpInfo, BlacklistStats, BlockReason } from '../types/security.types';

/**
 * IP 블랙리스트 관리 서비스 (리팩토링)
 */
@Injectable()
export class IpBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpBlacklistService.name);
  private redisClient: any;
  private connected = false;
  private readonly memoryCache = new Map<string, IpInfo>();

  private readonly config = {
    prefix: SECURITY_CONSTANTS.IP_BLACKLIST.PREFIX,
    setKey: SECURITY_CONSTANTS.IP_BLACKLIST.SET_KEY,
    defaultTtl: SECURITY_CONSTANTS.IP_BLACKLIST.DEFAULT_TTL,
  };

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeRedis();
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    const redisConfig = this.configService.get('app.redis');

    if (!redisConfig?.host) {
      this.logger.warn('Redis not configured, using in-memory storage only');
      return;
    }

    try {
      this.redisClient = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      this.redisClient.on('error', (err: Error) => this.handleRedisError(err));
      this.redisClient.on('connect', () => this.handleRedisConnect());
      this.redisClient.on('ready', () => this.handleRedisReady());

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      this.connected = false;
    }
  }

  /**
   * Handle Redis connection events
   */
  private handleRedisError(error: Error): void {
    this.logger.error('Redis error:', error);
    this.connected = false;
  }

  private handleRedisConnect(): void {
    this.logger.log('Redis connected');
  }

  private handleRedisReady(): void {
    this.logger.log('Redis ready');
    this.connected = true;
  }

  /**
   * Add IP to blacklist
   */
  async blacklistIp(
    ip: string,
    reason: BlockReason | string = BlockReason.MANUAL,
    ttl?: number,
  ): Promise<void> {
    const actualTtl = ttl || this.config.defaultTtl;
    const info: IpInfo = {
      ip,
      reason: reason.toString(),
      timestamp: new Date().toISOString(),
      ttl: actualTtl,
    };

    // Always add to memory cache
    this.memoryCache.set(ip, info);

    // Clean up old entries in memory cache
    this.cleanupMemoryCache();

    // Try to add to Redis
    if (this.connected && this.redisClient) {
      try {
        const key = `${this.config.prefix}${ip}`;
        const data = JSON.stringify(info);

        await this.redisClient.setEx(key, actualTtl, data);
        await this.redisClient.sAdd(this.config.setKey, ip);

        this.logger.log(`IP ${ip} blacklisted for ${actualTtl}s. Reason: ${reason}`);
      } catch (error) {
        this.logger.error(`Failed to blacklist IP ${ip} in Redis:`, error);
      }
    } else {
      this.logger.warn(`IP ${ip} added to memory blacklist only. Reason: ${reason}`);
    }
  }

  /**
   * Check if IP is blacklisted
   */
  async isBlacklisted(ip: string): Promise<boolean> {
    // Check memory cache first
    if (this.memoryCache.has(ip)) {
      const info = this.memoryCache.get(ip);

      // Check if entry is expired
      if (info && this.isExpired(info)) {
        this.memoryCache.delete(ip);
      } else {
        return true;
      }
    }

    // Check Redis if connected
    if (this.connected && this.redisClient) {
      try {
        const key = `${this.config.prefix}${ip}`;
        const exists = await this.redisClient.exists(key);

        if (exists) {
          // Refresh memory cache from Redis
          const data = await this.redisClient.get(key);
          if (data) {
            const info = JSON.parse(data);
            this.memoryCache.set(ip, info);
            this.logger.debug(`Blacklist hit for IP ${ip}: ${info.reason}`);
          }
          return true;
        }
      } catch (error) {
        this.logger.error(`Failed to check blacklist for IP ${ip}:`, error);
        // In case of error, check memory cache only
        return this.memoryCache.has(ip);
      }
    }

    return false;
  }

  /**
   * Remove IP from blacklist
   */
  async removeFromBlacklist(ip: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(ip);

    // Remove from Redis
    if (this.connected && this.redisClient) {
      try {
        const key = `${this.config.prefix}${ip}`;
        await this.redisClient.del(key);
        await this.redisClient.sRem(this.config.setKey, ip);

        this.logger.log(`IP ${ip} removed from blacklist`);
      } catch (error) {
        this.logger.error(`Failed to remove IP ${ip} from Redis blacklist:`, error);
      }
    }
  }

  /**
   * Get all blacklisted IPs
   */
  async getAllBlacklistedIps(): Promise<string[]> {
    const ips = new Set<string>();

    // Add from memory cache
    this.memoryCache.forEach((info, ip) => {
      if (!this.isExpired(info)) {
        ips.add(ip);
      }
    });

    // Add from Redis
    if (this.connected && this.redisClient) {
      try {
        const redisIps = await this.redisClient.sMembers(this.config.setKey);
        redisIps.forEach((ip: string) => ips.add(ip));
      } catch (error) {
        this.logger.error('Failed to get blacklisted IPs from Redis:', error);
      }
    }

    return Array.from(ips);
  }

  /**
   * Get IP information
   */
  async getIpInfo(ip: string): Promise<IpInfo | null> {
    // Check memory cache first
    if (this.memoryCache.has(ip)) {
      const info = this.memoryCache.get(ip);
      if (info && !this.isExpired(info)) {
        return info;
      }
    }

    // Check Redis
    if (this.connected && this.redisClient) {
      try {
        const key = `${this.config.prefix}${ip}`;
        const data = await this.redisClient.get(key);

        if (data) {
          const info = JSON.parse(data);
          const ttl = await this.redisClient.ttl(key);
          return { ...info, ttl };
        }
      } catch (error) {
        this.logger.error(`Failed to get info for IP ${ip}:`, error);
      }
    }

    return null;
  }

  /**
   * Get blacklist statistics
   */
  async getStatistics(): Promise<BlacklistStats> {
    const allIps = await this.getAllBlacklistedIps();

    return {
      totalBlacklisted: allIps.length,
      memoryBlacklisted: this.memoryCache.size,
      redisConnected: this.connected,
    };
  }

  /**
   * Blacklist IP range (CIDR notation)
   */
  async blacklistIpRange(cidr: string, reason: string = BlockReason.MANUAL): Promise<void> {
    // For simplicity, we're just logging this
    // In production, you'd want to use a library like 'ip-cidr' to expand the range
    this.logger.log(`IP range ${cidr} blacklisted. Reason: ${reason}`);

    // Store the CIDR range itself for now
    await this.blacklistIp(cidr, reason);
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(info: IpInfo): boolean {
    if (!info.ttl) return false;

    const createdAt = new Date(info.timestamp).getTime();
    const now = Date.now();
    const age = (now - createdAt) / 1000; // Age in seconds

    return age > info.ttl;
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const maxSize = 10000; // Maximum entries in memory

    // Remove expired entries
    for (const [ip, info] of this.memoryCache.entries()) {
      if (this.isExpired(info)) {
        this.memoryCache.delete(ip);
      }
    }

    // If still too large, remove oldest entries
    if (this.memoryCache.size > maxSize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort(
        (a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime(),
      );

      const toRemove = entries.slice(0, entries.length - maxSize);
      toRemove.forEach(([ip]) => this.memoryCache.delete(ip));
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryCache.clear();
  }
}
