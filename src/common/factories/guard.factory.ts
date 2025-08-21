import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BaseSecurityGuard } from '../guards/base-security.guard';
import { IpBlacklistGuard } from '../guards/ip-blacklist.guard';
import { UserAgentGuard } from '../guards/user-agent.guard';
import { HeadlessBrowserGuard } from '../guards/headless-browser.guard';
import { HoneypotGuard } from '../guards/honeypot.guard';
import { RecaptchaGuard } from '../guards/recaptcha.guard';

/**
 * Guard Registry
 * 모든 보안 가드를 중앙에서 관리
 */
@Injectable()
export class GuardFactory {
  private readonly guardMap = new Map<string, Type<BaseSecurityGuard>>();

  constructor(private readonly moduleRef: ModuleRef) {
    this.registerGuards();
  }

  /**
   * 가드 등록
   */
  private registerGuards(): void {
    this.guardMap.set('ip-blacklist', IpBlacklistGuard);
    this.guardMap.set('user-agent', UserAgentGuard);
    this.guardMap.set('headless-browser', HeadlessBrowserGuard);
    this.guardMap.set('honeypot', HoneypotGuard);
    this.guardMap.set('recaptcha', RecaptchaGuard);
  }

  /**
   * 가드 인스턴스 가져오기
   */
  getGuard(name: string): BaseSecurityGuard | null {
    const GuardClass = this.guardMap.get(name);
    if (!GuardClass) {
      return null;
    }

    try {
      return this.moduleRef.get(GuardClass, { strict: false });
    } catch {
      return null;
    }
  }

  /**
   * 여러 가드 인스턴스 가져오기
   */
  getGuards(names: string[]): BaseSecurityGuard[] {
    return names
      .map(name => this.getGuard(name))
      .filter((guard): guard is BaseSecurityGuard => guard !== null);
  }

  /**
   * 모든 가드 이름 가져오기
   */
  getGuardNames(): string[] {
    return Array.from(this.guardMap.keys());
  }

  /**
   * 가드 존재 여부 확인
   */
  hasGuard(name: string): boolean {
    return this.guardMap.has(name);
  }
}

/**
 * Guard Composition Utility
 * 여러 가드를 조합하여 사용
 */
@Injectable()
export class GuardComposer {
  constructor(private readonly guardFactory: GuardFactory) {}

  /**
   * 기본 보안 가드 세트
   */
  getBasicSecurityGuards(): BaseSecurityGuard[] {
    return this.guardFactory.getGuards(['ip-blacklist', 'user-agent']);
  }

  /**
   * 향상된 보안 가드 세트
   */
  getEnhancedSecurityGuards(): BaseSecurityGuard[] {
    return this.guardFactory.getGuards([
      'ip-blacklist',
      'user-agent',
      'headless-browser',
    ]);
  }

  /**
   * 최대 보안 가드 세트
   */
  getMaximumSecurityGuards(): BaseSecurityGuard[] {
    return this.guardFactory.getGuards([
      'ip-blacklist',
      'user-agent',
      'headless-browser',
      'honeypot',
      'recaptcha',
    ]);
  }

  /**
   * 커스텀 가드 조합
   */
  composeGuards(guardNames: string[]): BaseSecurityGuard[] {
    return this.guardFactory.getGuards(guardNames);
  }
}
