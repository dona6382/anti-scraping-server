import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpBlacklistService } from '../services/ip-blacklist.service';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlacklistMiddleware.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const ip = this.extractIp(req);

      if (!ip) {
        this.logger.error('Could not extract IP from request');
        return next();
      }

      const isBlacklisted = await this.ipBlacklistService.isBlacklisted(ip);

      if (isBlacklisted) {
        this.logger.warn(`[Blocked] Blacklisted IP detected: ${ip}`);
        throw new ForbiddenException('You are permanently banned.');
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error in IP blacklist middleware:', error);
      next();
    }
  }

  /**
   * Extract IP address from request
   */
  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      const ips = forwarded.split(',').map((ip) => ip.trim());
      return ips[0];
    }

    return (
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      ''
    );
  }
}
