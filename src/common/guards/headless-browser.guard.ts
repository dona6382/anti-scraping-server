import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { BaseSecurityGuard } from './base-security.guard';

/**
 * Headless Browser Detection Guard
 * Puppeteer, Playwright 등의 Headless 브라우저를 탐지
 */
@Injectable()
export class HeadlessBrowserGuard extends BaseSecurityGuard {
  protected readonly logger = new Logger(HeadlessBrowserGuard.name);

  protected getGuardName(): string {
    return 'HeadlessBrowserGuard';
  }

  protected validateRequest(request: Request): boolean {
    const headers = request.headers;
    const userAgent = this.getUserAgent(request).toLowerCase();

    // Headless 브라우저 시그니처 검사
    const headlessSignatures = [
      'headless',
      'phantomjs',
      'slimerjs',
      'chrome-lighthouse',
    ];

    // User-Agent에서 Headless 시그니처 확인
    for (const signature of headlessSignatures) {
      if (userAgent.includes(signature)) {
        this.logger.warn(`Headless browser detected: ${signature} in User-Agent`);
        return false;
      }
    }

    // Chrome DevTools Protocol 감지
    if (headers['chrome-proxy'] || headers['x-chrome-uma-enabled']) {
      this.logger.warn('Chrome DevTools Protocol detected');
      return false;
    }

    // Puppeteer 특정 헤더 감지
    if (headers['puppeteer-extra-plugin']) {
      this.logger.warn('Puppeteer-extra plugin detected');
      return false;
    }

    // WebDriver 감지
    const webdriverHeaders = [
      'webdriver',
      'selenium',
      'webdriver-remote',
      '__webdriver_evaluate',
      '__selenium_evaluate',
      '__webdriver_script_function',
      '__webdriver_script_func',
      '__webdriver_script_fn',
      '__fxdriver_evaluate',
      '__driver_unwrapped',
      '__webdriver_unwrapped',
      '__driver_evaluate',
      '__selenium_unwrapped',
      '__fxdriver_unwrapped',
    ];

    for (const header of webdriverHeaders) {
      if (headers[header]) {
        this.logger.warn(`WebDriver header detected: ${header}`);
        return false;
      }
    }

    // Navigator.webdriver 속성 체크 (클라이언트 사이드에서 전송된 경우)
    if (request.body && request.body._browserProps) {
      const browserProps = request.body._browserProps;
      if (browserProps.webdriver === true) {
        this.logger.warn('Navigator.webdriver property is true');
        return false;
      }
      
      // 브라우저 속성 이상 탐지
      if (!browserProps.languages || browserProps.languages.length === 0) {
        this.logger.warn('No browser languages detected');
        return false;
      }
      
      if (browserProps.plugins && browserProps.plugins.length === 0 && !this.isMobile(userAgent)) {
        this.logger.warn('No browser plugins detected on desktop');
        return false;
      }
    }

    return true;
  }

  /**
   * 모바일 디바이스인지 확인
   */
  private isMobile(userAgent: string): boolean {
    const mobilePatterns = [
      'mobile',
      'android',
      'iphone',
      'ipad',
      'ipod',
      'blackberry',
      'windows phone',
      'opera mini',
      'opera mobi',
    ];
    
    return mobilePatterns.some((pattern) => userAgent.includes(pattern));
  }

  protected getFailureMessage(request: Request): string {
    return 'Headless browser or automation tool detected';
  }
}
