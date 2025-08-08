/**
 * User-Agent Value Object
 * User-Agent 문자열을 분석하고 정보를 제공하는 불변 값 객체
 */
export class UserAgent {
  private readonly value: string;
  private readonly normalized: string;

  constructor(value: string = '') {
    this.value = value;
    this.normalized = value.toLowerCase();
  }

  /**
   * User-Agent 문자열 반환
   */
  toString(): string {
    return this.value;
  }

  /**
   * 빈 User-Agent인지 확인
   */
  isEmpty(): boolean {
    return !this.value || this.value.trim().length === 0;
  }

  /**
   * 브라우저 종류 확인
   */
  getBrowser(): BrowserType {
    if (this.isChrome()) return BrowserType.CHROME;
    if (this.isFirefox()) return BrowserType.FIREFOX;
    if (this.isSafari()) return BrowserType.SAFARI;
    if (this.isEdge()) return BrowserType.EDGE;
    if (this.isOpera()) return BrowserType.OPERA;
    if (this.isIE()) return BrowserType.IE;
    return BrowserType.UNKNOWN;
  }

  /**
   * 봇/크롤러 여부 확인
   */
  isBot(): boolean {
    const botPatterns = [
      /bot/i,
      /crawl/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /ruby/i,
      /perl/i,
      /go-http/i,
      /postman/i,
      /insomnia/i,
      /axios/i,
      /node-fetch/i,
      /okhttp/i,
      /mechanize/i,
      /phantomjs/i,
      /headless/i,
    ];

    return botPatterns.some(pattern => pattern.test(this.value));
  }

  /**
   * 헤드리스 브라우저 여부 확인
   */
  isHeadless(): boolean {
    const headlessPatterns = [
      /headless/i,
      /phantomjs/i,
      /slimerjs/i,
      /splash/i,
    ];

    // Chrome headless specific check
    if (this.isChrome() && this.normalized.includes('headless')) {
      return true;
    }

    // Check for automation tools
    if (this.normalized.includes('selenium') || 
        this.normalized.includes('webdriver') ||
        this.normalized.includes('puppeteer') ||
        this.normalized.includes('playwright')) {
      return true;
    }

    return headlessPatterns.some(pattern => pattern.test(this.value));
  }

  /**
   * 모바일 디바이스 여부 확인
   */
  isMobile(): boolean {
    const mobilePatterns = [
      /mobile/i,
      /android/i,
      /iphone/i,
      /ipad/i,
      /ipod/i,
      /windows phone/i,
      /blackberry/i,
      /opera mini/i,
    ];

    return mobilePatterns.some(pattern => pattern.test(this.value));
  }

  /**
   * 운영체제 확인
   */
  getOS(): OperatingSystem {
    if (/windows/i.test(this.value)) return OperatingSystem.WINDOWS;
    if (/mac os|macintosh/i.test(this.value)) return OperatingSystem.MACOS;
    if (/linux/i.test(this.value)) return OperatingSystem.LINUX;
    if (/android/i.test(this.value)) return OperatingSystem.ANDROID;
    if (/ios|iphone|ipad|ipod/i.test(this.value)) return OperatingSystem.IOS;
    return OperatingSystem.UNKNOWN;
  }

  /**
   * 의심스러운 패턴 확인
   */
  hasSuspiciousPattern(): boolean {
    // Too short
    if (this.value.length < 10) return true;
    
    // Too long
    if (this.value.length > 500) return true;
    
    // No spaces (most legitimate UAs have spaces)
    if (!this.value.includes(' ')) return true;
    
    // Suspicious patterns
    const suspiciousPatterns = [
      /^Mozilla$/,
      /^Opera$/,
      /^Safari$/,
      /user-?agent/i,
      /\.\.\./,
      /<script/i,
      /javascript:/i,
      /data:/i,
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(this.value));
  }

  /**
   * Chrome 브라우저 여부
   */
  private isChrome(): boolean {
    return this.normalized.includes('chrome') && !this.isEdge() && !this.isOpera();
  }

  /**
   * Firefox 브라우저 여부
   */
  private isFirefox(): boolean {
    return this.normalized.includes('firefox');
  }

  /**
   * Safari 브라우저 여부
   */
  private isSafari(): boolean {
    return this.normalized.includes('safari') && !this.isChrome() && !this.isEdge();
  }

  /**
   * Edge 브라우저 여부
   */
  private isEdge(): boolean {
    return this.normalized.includes('edge') || this.normalized.includes('edg/');
  }

  /**
   * Opera 브라우저 여부
   */
  private isOpera(): boolean {
    return this.normalized.includes('opera') || this.normalized.includes('opr/');
  }

  /**
   * Internet Explorer 여부
   */
  private isIE(): boolean {
    return this.normalized.includes('msie') || this.normalized.includes('trident');
  }

  /**
   * 두 User-Agent가 같은지 비교
   */
  equals(other: UserAgent): boolean {
    return this.value === other.value;
  }

  /**
   * 리스크 점수 계산 (0-100)
   */
  getRiskScore(): number {
    let score = 0;

    if (this.isEmpty()) score += 30;
    if (this.isBot()) score += 40;
    if (this.isHeadless()) score += 50;
    if (this.hasSuspiciousPattern()) score += 30;
    
    // Reduce score for known browsers
    if (this.getBrowser() !== BrowserType.UNKNOWN) score -= 20;
    
    // Reduce score for mobile (usually legitimate)
    if (this.isMobile()) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * 브라우저 종류
 */
export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  SAFARI = 'safari',
  EDGE = 'edge',
  OPERA = 'opera',
  IE = 'ie',
  UNKNOWN = 'unknown'
}

/**
 * 운영체제 종류
 */
export enum OperatingSystem {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  ANDROID = 'android',
  IOS = 'ios',
  UNKNOWN = 'unknown'
}
