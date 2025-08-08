/**
 * Anti-scraping 관련 상수 정의
 */

export const SECURITY_CONSTANTS = {
  // Rate Limiting
  RATE_LIMIT: {
    DEFAULT_TTL: 10,
    DEFAULT_LIMIT: 20,
    STRICT_TTL: 60,
    STRICT_LIMIT: 10,
    CRITICAL_TTL: 600,
    CRITICAL_LIMIT: 3,
  },

  // IP Blacklist
  IP_BLACKLIST: {
    PREFIX: 'blacklist:ip:',
    SET_KEY: 'blacklist:ips',
    DEFAULT_TTL: 86400, // 24 hours
    TEMPORARY_TTL: 3600, // 1 hour
    EXTENDED_TTL: 604800, // 7 days
  },

  // User-Agent
  USER_AGENT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },

  // Honeypot
  HONEYPOT: {
    TIME_THRESHOLD: 2000, // 2 seconds
    TOKEN_EXPIRY: 3600000, // 1 hour
  },

  // reCAPTCHA
  RECAPTCHA: {
    VERIFY_URL: 'https://www.google.com/recaptcha/api/siteverify',
    DEFAULT_THRESHOLD: 0.5,
    LOW_SCORE_THRESHOLD: 0.3,
    TIMEOUT: 5000,
  },

  // Headers
  HEADERS: {
    IP: ['x-forwarded-for', 'x-real-ip', 'x-client-ip', 'cf-connecting-ip', 'true-client-ip'],
    PROXY: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'via', 'forwarded'],
    CHROME: ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'],
  },
} as const;

export const ERROR_MESSAGES = {
  INVALID_REQUEST: 'Invalid request',
  ACCESS_DENIED: 'Access denied',
  USER_AGENT_REQUIRED: 'User-Agent header is required',
  AUTOMATED_BROWSER: 'Automated browser detected',
  IP_BLOCKED: 'Your IP address has been blocked',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  RECAPTCHA_REQUIRED: 'reCAPTCHA verification required',
  RECAPTCHA_FAILED: 'reCAPTCHA verification failed',
  BOT_DETECTED: 'Bot activity detected',
} as const;

export const LOG_MESSAGES = {
  BLOCKED: '[BLOCKED]',
  WARNING: '[WARNING]',
  ALLOWED: '[ALLOWED]',
  DETECTED: '[DETECTED]',
  ERROR: '[ERROR]',
} as const;

export const BLOCKED_USER_AGENTS = [
  // Web scrapers
  'scrapy',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'java',
  'perl',
  'ruby',
  'php',

  // Command line tools
  'curl',
  'wget',
  'httpie',

  // API testing tools
  'postman',
  'insomnia',
  'paw',

  // Node.js libraries
  'axios',
  'node-fetch',
  'got',
  'undici',
  'superagent',

  // Other libraries
  'libwww-perl',
  'mechanize',
  'httpclient',

  // Headless browsers
  'phantomjs',
  'headlesschrome',
  'nightmare',
  'zombie',
] as const;

export const SUSPICIOUS_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /scrape/i,
  /fetch/i,
  /scan/i,
  /audit/i,
  /monitor/i,
] as const;

export const VALID_BROWSER_KEYWORDS = [
  'Mozilla',
  'Chrome',
  'Safari',
  'Firefox',
  'Edge',
  'Opera',
  'Trident',
] as const;
