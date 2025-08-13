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
 * 의심스러운 User-Agent 패턴들
 */
export const SUSPICIOUS_PATTERNS = [
  // 버전이 없거나 이상한 패턴
  /^Mozilla\/5\.0$/,
  /^Mozilla$/,
  /^Chrome$/,
  /^Safari$/,
  
  // 너무 오래된 브라우저
  /MSIE [1-8]\./,
  /Chrome\/[1-9]\./,
  /Firefox\/[1-9]\./,
  
  // 의심스러운 키워드
  /hack/i,
  /exploit/i,
  /injection/i,
  /vulnerability/i,
  
  // 자동화 도구 흔적
  /automation/i,
  /testing/i,
  /robot/i,
  /artificial/i,
];

/**
 * 화이트리스트된 User-Agent (검증 제외)
 */
export const WHITELISTED_USER_AGENTS = [
  // 주요 검색엔진 (실제 봇은 IP로도 검증해야 함)
  'Googlebot',
  'Bingbot', 
  'Slurp',
  'DuckDuckBot',
  
  // 소셜 미디어 크롤러
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  
  // 합법적인 모니터링 도구
  'Pingdom',
  'UptimeRobot',
  'StatusCake',
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
