import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpBlacklistService } from '../services/ip-blacklist.service';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlacklistMiddleware.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip;
    if (this.ipBlacklistService.isBlacklisted(ip)) {
      this.logger.warn(`[Blocked] Blacklisted IP detected: ${ip}`);
      throw new ForbiddenException('You are permanently banned.');
    }
    next();
  }
}