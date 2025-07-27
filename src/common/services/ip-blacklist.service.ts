import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IpBlacklistService {
  private readonly logger = new Logger(IpBlacklistService.name);
  // 프로덕션에서는 Redis Set을 사용하는 것이 훨씬 효율적입니다.
  private blacklist: Set<string> = new Set();

  add(ip: string) {
    if (!this.blacklist.has(ip)) {
      this.logger.log(
        `[Blacklisted] IP: ${ip} has been added to the blacklist.`,
      );
      this.blacklist.add(ip);
    }
  }

  isBlacklisted(ip: string | undefined): boolean {
    return this.blacklist.has(<string>ip);
  }
}