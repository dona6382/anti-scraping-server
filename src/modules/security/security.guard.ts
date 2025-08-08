import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IRequestContext } from '../../core/domain/interfaces/security.interfaces';
import { SecurityOrchestrator } from '../../core/application/services/security-orchestrator.service';
import { IpAddress } from '../../core/domain/value-objects/ip-address.vo';
import {
  BotDetectedException,
  InvalidUserAgentException,
  HeadlessBrowserException,
  HoneypotTriggedException,
  IpBlacklistedException,
  AccessDeniedException,
} from '../../core/domain/exceptions/domain.exceptions';

/**
 * Unified Security Guard
 * 모든 보안 검증을 통합한 가드
 */
@Injectable()
export class UnifiedSecurityGuard implements CanActivate {
  private readonly logger = new Logger(UnifiedSecurityGuard.name);

  constructor(
    private readonly securityOrchestrator: SecurityOrchestrator,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if security is disabled for this route
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestContext = this.createRequestContext(request);

    try {
      // Run security validation
      const result = await this.securityOrchestrator.validateRequest(requestContext);

      if (!result.passed) {
        this.handleSecurityFailure(result.failureReason || 'Security validation failed', requestContext);
      }

      // Attach security metadata to request
      request.securityContext = {
        validated: true,
        riskScore: result.riskScore,
        metadata: result.metadata,
      };

      return true;
    } catch (error) {
      if (error instanceof BotDetectedException ||
          error instanceof InvalidUserAgentException ||
          error instanceof HeadlessBrowserException ||
          error instanceof HoneypotTriggedException ||
          error instanceof IpBlacklistedException) {
        throw error;
      }

      this.logger.error('Security validation error:', error);
      throw new AccessDeniedException('Security validation failed');
    }
  }

  /**
   * Create request context from HTTP request
   */
  private createRequestContext(request: any): IRequestContext {
    const ipAddress = IpAddress.fromRequest(request);

    return {
      ip: ipAddress.toString(),
      userAgent: request.headers['user-agent'] || '',
      path: request.path || request.url || '',
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body,
      timestamp: new Date(),
      sessionId: request.session?.id,
    };
  }

  /**
   * Handle security validation failure
   */
  private handleSecurityFailure(reason: string, context: IRequestContext): void {
    this.logger.warn(
      `Security validation failed: ${reason}`,
      {
        ip: new IpAddress(context.ip).getMasked(),
        path: context.path,
        method: context.method,
      }
    );

    throw new AccessDeniedException('Security validation failed', reason);
  }
}

/**
 * IP Blacklist Guard
 * IP 블랙리스트 전용 가드
 */
@Injectable()
export class IpBlacklistGuard implements CanActivate {
  private readonly logger = new Logger(IpBlacklistGuard.name);

  constructor(
    private readonly ipValidationService: any, // IIpValidationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = IpAddress.fromRequest(request);

    const result = await this.ipValidationService.validate(ipAddress.toString());

    if (result.isBlacklisted) {
      this.logger.warn(`Blacklisted IP attempted access: ${ipAddress.getMasked()}`);
      throw new IpBlacklistedException(ipAddress.toString(), result.reason);
    }

    return true;
  }
}

/**
 * Rate Limit Guard
 * Rate limiting 전용 가드
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimiter: any, // IRateLimiter
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = IpAddress.fromRequest(request);
    const key = `rate-limit:${ipAddress.toString()}`;

    const result = await this.rateLimiter.checkLimit(key);

    if (!result.allowed) {
      this.logger.warn(
        `Rate limit exceeded for IP: ${ipAddress.getMasked()}`,
        { remaining: result.remaining, resetAt: result.resetAt }
      );
      
      // Set rate limit headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', result.limit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      throw new AccessDeniedException(
        'Rate limit exceeded',
        `Too many requests. Please try again after ${result.resetAt.toISOString()}`
      );
    }

    // Consume rate limit point
    await this.rateLimiter.consume(key);

    return true;
  }
}

/**
 * Public Route Decorator
 * Mark routes as public (bypass security)
 */
export const Public = () => (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) {
    Reflect.defineMetadata('isPublic', true, descriptor.value);
    return descriptor;
  }
  Reflect.defineMetadata('isPublic', true, target);
  return target;
};

/**
 * Security Options Decorator
 * Configure security options for specific routes
 */
export interface SecurityOptions {
  skipStrategies?: string[];
  riskThreshold?: number;
  customMetadata?: Record<string, any>;
}

export const Security = (options: SecurityOptions) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('securityOptions', options, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata('securityOptions', options, target);
    return target;
  };
};
