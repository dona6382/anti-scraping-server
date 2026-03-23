/**
 * Security Constants
 * 보안 관련 상수 정의
 */

/**
 * 차단된 User-Agent 패턴들
 */
export const BLOCKED_USER_AGENTS = [
  // 일반적인 봇들
  'bot', 'crawler', 'spider', 'scraper',
  
  // 자동화 도구들
  'selenium', 'webdriver', 'phantomjs', 'headless',
  'chrome-headless', 'chromium', 'playwright',
  
  // HTTP 클라이언트들
  'curl', 'wget', 'httpie', 'python-requests',
  'java/', 'go-http-client', 'okhttp',
  
  // 스크래핑 라이브러리들
  'scrapy', 'beautifulsoup', 'mechanize',
  'jsoup', 'htmlunit', 'apache-httpclient',
  
  // 특정 봇들
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'baiduspider', 'yandexbot', 'facebookexternalhit',
  
  // 의심스러운 패턴들
  'test', 'check', 'monitor', 'scan',
  'probe', 'fetch', 'download',
];

/**
 * 봇 탐지 정규식 패턴들
 * UserAgentGuard, ClientInfoService, TestingService 등에서 공통 사용
 */
export const BOT_PATTERNS: RegExp[] = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java\//i,
  /ruby/i,
];

/**
 * 크롤러 전용 탐지 패턴
 */
export const CRAWLER_PATTERNS: RegExp[] = [
  /crawl/i,
  /spider/i,
  /scrape/i,
  /harvest/i,
  /extract/i,
];

/**
 * 의심스러운 User-Agent 패턴들 (strict mode 전용)
 */
export const SUSPICIOUS_UA_PATTERNS: RegExp[] = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /scrape/i,
  /harvest/i,
  /extract/i,
  /grab/i,
  /fetch/i,
  /mine/i,
  /scan/i,
];

/**
 * 허용된 봇 목록 (strict mode에서도 통과)
 */
export const ALLOWED_BOTS: string[] = [
  'googlebot',
  'bingbot',
  'slackbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'whatsapp',
  'telegram',
];

/**
 * 모바일 디바이스 패턴
 */
export const MOBILE_PATTERNS: RegExp[] = [
  /mobile/i,
  /android/i,
  /iphone/i,
  /ipad/i,
  /ipod/i,
  /blackberry/i,
  /windows phone/i,
  /opera mini/i,
  /opera mobi/i,
];

/**
 * 태블릿 디바이스 패턴
 */
export const TABLET_PATTERNS: RegExp[] = [
  /tablet/i,
  /ipad/i,
];

/**
 * IP 차단 사유 코드
 */
export const BLOCK_REASONS = {
  MANUAL: 'MANUAL_ADMIN_ACTION',
  BOT_DETECTED: 'BOT_DETECTED',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED', 
  SUSPICIOUS_BEHAVIOR: 'SUSPICIOUS_BEHAVIOR',
  HONEYPOT_TRIGGERED: 'HONEYPOT_TRIGGERED',
  INVALID_USER_AGENT: 'INVALID_USER_AGENT',
  HEADLESS_BROWSER: 'HEADLESS_BROWSER_DETECTED',
  RECAPTCHA_FAILED: 'RECAPTCHA_VERIFICATION_FAILED',
} as const;

/**
 * 보안 설정 기본값
 */
export const SECURITY_DEFAULTS = {
  // IP 차단 기본 TTL (초)
  DEFAULT_BLOCK_TTL: 86400, // 24시간
  
  // Honeypot 기본 설정
  HONEYPOT_FIELD_NAME: 'email_confirm',
  HONEYPOT_TIME_THRESHOLD: 2000, // 2초
  
  // Rate Limiting 기본값
  DEFAULT_RATE_LIMIT: 100,
  DEFAULT_RATE_WINDOW: 60000, // 1분
  
  // reCAPTCHA 기본 임계값
  RECAPTCHA_SCORE_THRESHOLD: 0.5,
} as const;
