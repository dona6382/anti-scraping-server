// src/core/config/config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { AppConfig } from './config.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService<AppConfig, true>) {}

  // Server Configuration
  get serverConfig() {
    return this.configService.get('server', { infer: true });
  }

  get port(): number {
    return this.serverConfig.port;
  }

  get nodeEnv(): string {
    return this.serverConfig.nodeEnv;
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get corsOrigins(): string[] {
    return this.serverConfig.corsOrigins;
  }

  // Security Configuration
  get securityConfig() {
    return this.configService.get('security', { infer: true });
  }

  get isStrictMode(): boolean {
    return this.securityConfig.strictMode;
  }

  get rateLimitConfig() {
    return this.securityConfig.rateLimit;
  }

  get ipBlacklistConfig() {
    return this.securityConfig.ipBlacklist;
  }

  get userAgentConfig() {
    return this.securityConfig.userAgent;
  }

  get honeypotConfig() {
    return this.securityConfig.honeypot;
  }

  // Redis Configuration
  get redisConfig() {
    return this.configService.get('redis', { infer: true });
  }

  // Database Configuration
  get databaseConfig() {
    return this.configService.get('database', { infer: true });
  }

  // Logging Configuration
  get loggingConfig() {
    return this.configService.get('logging', { infer: true });
  }

  // Utility Methods
  get<T = unknown>(key: keyof AppConfig): T {
    return this.configService.get(key) as T;
  }

  getOrThrow<T = unknown>(key: keyof AppConfig): T {
    return this.configService.getOrThrow(key) as T;
  }
}
