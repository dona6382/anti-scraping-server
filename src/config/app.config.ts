import { registerAs } from '@nestjs/config';

/**
 * Application configuration (리팩토링)
 */
export default registerAs('app', () => ({
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Security
  security: {
    strictMode: process.env.SECURITY_STRICT_MODE === 'true',
  },

  // Rate Limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '10', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '20', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // reCAPTCHA
  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
    scoreThreshold: parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || '0.5'),
    failOpen: process.env.RECAPTCHA_FAIL_OPEN === 'true',
    allowedHostnames: process.env.RECAPTCHA_ALLOWED_HOSTNAMES
      ? process.env.RECAPTCHA_ALLOWED_HOSTNAMES.split(',').map((h) => h.trim())
      : [],
  },

  // IP Blacklist
  ipBlacklist: {
    ttl: parseInt(process.env.IP_BLACKLIST_TTL || '86400', 10),
    maxMemorySize: parseInt(process.env.IP_BLACKLIST_MAX_MEMORY || '10000', 10),
  },

  // User-Agent
  blockedUserAgents: process.env.BLOCKED_USER_AGENTS
    ? process.env.BLOCKED_USER_AGENTS.split(',').map((agent) => agent.trim().toLowerCase())
    : [],

  // Honeypot
  honeypot: {
    fieldName: process.env.HONEYPOT_FIELD_NAME || 'email_confirm',
    timeThreshold: parseInt(process.env.HONEYPOT_TIME_THRESHOLD || '2000', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    prettyPrint: process.env.LOG_PRETTY === 'true',
  },
}));
