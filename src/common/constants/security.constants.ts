/**
 * Security Constants
 * 보안 관련 상수 정의
 */

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

