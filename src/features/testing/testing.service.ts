import { Injectable, Logger, Inject } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../../core/config/config.service';
import { CacheFactory } from '../../core/cache/cache.factory';
import { ICacheService } from '../security/services/cache.service';
import { RequestUtils } from '../../shared/utils/request.utils';
import { HoneypotException } from '../../shared/exceptions';

/**
 * Testing Service
 * 보안 기능 및 시스템 테스트를 위한 서비스
 */
@Injectable()
export class TestingService {
  private readonly logger = new Logger(TestingService.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly cacheFactory: CacheFactory,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  /**
   * 기본 테스트
   */
  async performBasicTest(request: Request) {
    const clientIp = RequestUtils.extractClientIp(request);
    const userAgent = RequestUtils.extractUserAgent(request);
    
    return {
      success: true,
      message: 'Basic test completed successfully',
      data: {
        timestamp: new Date().toISOString(),
        clientIp: RequestUtils.maskIp(clientIp),
        userAgent: RequestUtils.sanitizeUserAgent(userAgent),
        method: request.method,
        url: request.url,
        headers: Object.keys(request.headers).length,
        environment: this.configService.nodeEnv,
      },
    };
  }

  /**
   * User-Agent 가드 테스트
   */
  async testUserAgentGuard(request: Request) {
    const userAgent = RequestUtils.extractUserAgent(request);
    const isBot = RequestUtils.isBotUserAgent(userAgent);
    const isKnownGoodBot = RequestUtils.isKnownGoodBot(userAgent);
    
    return {
      success: true,
      message: 'User-Agent guard test completed',
      data: {
        userAgent: RequestUtils.sanitizeUserAgent(userAgent),
        isBot,
        isKnownGoodBot,
        passed: true, // 이 지점에 도달했다면 통과
        blockedAgents: this.configService.userAgentConfig.blockedAgents.slice(0, 3),
        strictMode: this.configService.userAgentConfig.strictMode,
      },
    };
  }

  /**
   * 허니팟 테스트
   */
  async testHoneypot(body: any, request: Request) {
    const honeypotField = this.configService.honeypotConfig.fieldName;
    const honeypotValue = body[honeypotField];
    
    // 허니팟 필드가 채워져 있으면 봇으로 간주
    if (honeypotValue && honeypotValue.trim() !== '') {
      const clientIp = RequestUtils.extractClientIp(request);
      throw new HoneypotException(clientIp, honeypotField);
    }
    
    return {
      success: true,
      message: 'Honeypot test passed - human user detected',
      data: {
        honeypotField,
        honeypotValue: honeypotValue || null,
        bodyKeys: Object.keys(body),
        passed: true,
      },
    };
  }

  /**
   * 종합 보안 테스트
   */
  async performFullSecurityTest(request: Request) {
    const clientIp = RequestUtils.extractClientIp(request);
    const userAgent = RequestUtils.extractUserAgent(request);
    const securityHeaders = RequestUtils.hasSecurityHeaders(request);
    
    const testResults = {
      ip: {
        address: RequestUtils.maskIp(clientIp),
        isValid: RequestUtils.isValidIpAddress(clientIp),
        isPrivate: this.isPrivateIp(clientIp),
      },
      userAgent: {
        value: RequestUtils.sanitizeUserAgent(userAgent),
        isBot: RequestUtils.isBotUserAgent(userAgent),
        isKnownGood: RequestUtils.isKnownGoodBot(userAgent),
      },
      headers: {
        hasRequired: securityHeaders.hasHeaders,
        missing: securityHeaders.missing,
        total: Object.keys(request.headers).length,
      },
      security: {
        strictMode: this.configService.isStrictMode,
        rateLimit: this.configService.rateLimitConfig,
      },
    };
    
    return {
      success: true,
      message: 'Full security test completed',
      data: testResults,
    };
  }

  /**
   * 캐시 시스템 테스트
   */
  async testCacheSystem() {
    const testKey = 'test:cache:' + Date.now();
    const testValue = { message: 'Cache test', timestamp: new Date().toISOString() };
    
    try {
      // 캐시 저장 테스트
      await this.cacheService.set(testKey, testValue, 60);
      
      // 캐시 조회 테스트
      const retrieved = await this.cacheService.get(testKey);
      
      // 캐시 존재 확인 테스트
      const exists = await this.cacheService.exists(testKey);
      
      // TTL 확인 테스트
      const ttl = await this.cacheService.getTtl(testKey);
      
      // 캐시 삭제 테스트
      await this.cacheService.delete(testKey);
      const deletedExists = await this.cacheService.exists(testKey);
      
      // 캐시 통계 조회
      const cacheStats = await this.cacheFactory.getCacheStats();
      
      return {
        success: true,
        message: 'Cache system test completed',
        data: {
          setTest: { success: true },
          getTest: { success: true, retrieved: retrieved !== null },
          existsTest: { beforeDelete: exists, afterDelete: deletedExists },
          ttlTest: { ttl },
          cacheInfo: cacheStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Cache system test failed',
        error: error.message,
      };
    }
  }

  /**
   * 설정 시스템 테스트
   */
  async testConfigurationSystem() {
    return {
      success: true,
      message: 'Configuration system test completed',
      data: {
        server: {
          port: this.configService.port,
          environment: this.configService.nodeEnv,
          isDevelopment: this.configService.isDevelopment,
          isProduction: this.configService.isProduction,
        },
        security: {
          strictMode: this.configService.isStrictMode,
          userAgent: {
            blockedCount: this.configService.userAgentConfig.blockedAgents.length,
            strictMode: this.configService.userAgentConfig.strictMode,
          },
          rateLimit: this.configService.rateLimitConfig,
          ipBlacklist: {
            enabled: this.configService.ipBlacklistConfig.enabled,
            ttl: this.configService.ipBlacklistConfig.ttl,
          },
          honeypot: {
            fieldName: this.configService.honeypotConfig.fieldName,
            enabled: this.configService.honeypotConfig.enabled,
          },
        },
        redis: {
          host: this.configService.redisConfig.host || 'not configured',
          port: this.configService.redisConfig.port,
          db: this.configService.redisConfig.db,
        },
      },
    };
  }

  /**
   * 에러 처리 테스트
   */
  async testErrorHandling(request: Request) {
    const errorType = request.url.split('/').pop();
    
    switch (errorType) {
      case 'validation':
        throw new Error('Test validation error');
      case 'security':
        const clientIp = RequestUtils.extractClientIp(request);
        throw new HoneypotException(clientIp, 'test_field');
      case 'system':
        throw new Error('Test system error');
      case 'timeout':
        // 타임아웃 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Test timeout error');
      default:
        return {
          success: true,
          message: 'Error handling test - no error triggered',
          data: {
            availableTypes: ['validation', 'security', 'system', 'timeout'],
            currentType: errorType,
          },
        };
    }
  }

  /**
   * 성능 테스트
   */
  async performPerformanceTest() {
    const startTime = process.hrtime.bigint();
    
    // 다양한 연산 수행
    const operations = [];
    
    // 1. 메모리 사용량 측정
    const memoryBefore = process.memoryUsage();
    
    // 2. CPU 집약적 작업
    const cpuStart = process.hrtime.bigint();
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += Math.random();
    }
    const cpuTime = Number(process.hrtime.bigint() - cpuStart) / 1000000;
    operations.push({ name: 'CPU intensive task', time: cpuTime, result: sum > 0 });
    
    // 3. 캐시 성능 테스트
    const cacheStart = process.hrtime.bigint();
    const cacheKey = 'perf:test:' + Date.now();
    await this.cacheService.set(cacheKey, { test: true });
    const cacheResult = await this.cacheService.get(cacheKey);
    await this.cacheService.delete(cacheKey);
    const cacheTime = Number(process.hrtime.bigint() - cacheStart) / 1000000;
    operations.push({ name: 'Cache operations', time: cacheTime, result: cacheResult !== null });
    
    // 4. 설정 조회 성능
    const configStart = process.hrtime.bigint();
    const configTest = this.configService.nodeEnv;
    const configTime = Number(process.hrtime.bigint() - configStart) / 1000000;
    operations.push({ name: 'Config access', time: configTime, result: configTest !== undefined });
    
    const memoryAfter = process.memoryUsage();
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    return {
      success: true,
      message: 'Performance test completed',
      data: {
        totalTime: `${totalTime.toFixed(2)}ms`,
        operations,
        memory: {
          before: {
            heapUsed: Math.round(memoryBefore.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryBefore.heapTotal / 1024 / 1024),
          },
          after: {
            heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryAfter.heapTotal / 1024 / 1024),
          },
          delta: {
            heapUsed: Math.round((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024),
            heapTotal: Math.round((memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024),
          },
        },
        system: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
    };
  }

  /**
   * 프라이빗 IP 확인 헬퍼
   */
  private isPrivateIp(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
    ];

    return privateRanges.some(range => range.test(ip));
  }
}
