import { SetMetadata } from '@nestjs/common';
import { SecurityReason } from '../../types';

/**
 * Security Metadata Keys
 */
export const SECURITY_CONFIG_KEY = 'security:config';
export const SKIP_GUARDS_KEY = 'security:skip';
export const RATE_LIMIT_KEY = 'security:rateLimit';

/**
 * Security Configuration Interface
 */
export interface SecurityConfig {
  skipGuards?: string[];
  rateLimit?: {
    ttl: number;
    limit: number;
  };
  recaptcha?: {
    required: boolean;
    scoreThreshold?: number;
  };
  honeypot?: {
    fieldName?: string;
    timeThreshold?: number;
  };
}

/**
 * Security configuration decorator
 */
export const Security = (config: SecurityConfig) => 
  SetMetadata(SECURITY_CONFIG_KEY, config);

/**
 * Skip specific guards
 */
export const SkipGuards = (...guards: string[]) => 
  SetMetadata(SKIP_GUARDS_KEY, guards);

/**
 * Apply rate limiting
 */
export const RateLimit = (ttl: number, limit: number) => 
  SetMetadata(RATE_LIMIT_KEY, { ttl, limit });

/**
 * Public endpoint (skip all guards)
 */
export const Public = () => 
  SetMetadata(SKIP_GUARDS_KEY, ['all']);

/**
 * Require reCAPTCHA
 */
export const RequireRecaptcha = (scoreThreshold: number = 0.5) => 
  SetMetadata('recaptcha:required', { scoreThreshold });

/**
 * Client IP decorator
 */
export const ClientIp = () => (target: any, key: string, index: number) => {
  const existingMetadata = Reflect.getMetadata('custom:params', target, key) || [];
  existingMetadata.push({ index, type: 'ClientIp' });
  Reflect.defineMetadata('custom:params', existingMetadata, target, key);
};

/**
 * User Agent decorator
 */
export const UserAgent = () => (target: any, key: string, index: number) => {
  const existingMetadata = Reflect.getMetadata('custom:params', target, key) || [];
  existingMetadata.push({ index, type: 'UserAgent' });
  Reflect.defineMetadata('custom:params', existingMetadata, target, key);
};
