import {
  IsIP,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SECURITY_REASONS = [
  'MANUAL_ADMIN_ACTION',
  'BOT_DETECTED',
  'RATE_LIMIT_EXCEEDED',
  'SUSPICIOUS_BEHAVIOR',
  'HONEYPOT_TRIGGERED',
  'INVALID_USER_AGENT',
  'HEADLESS_BROWSER_DETECTED',
  'RECAPTCHA_VERIFICATION_FAILED',
] as const;

export class BlockIpDto {
  @ApiProperty({ example: '192.168.1.100' })
  @IsIP()
  ip: string;

  @ApiProperty({ example: 'MANUAL_ADMIN_ACTION', enum: SECURITY_REASONS })
  @IsEnum(SECURITY_REASONS)
  reason: (typeof SECURITY_REASONS)[number];

  @ApiPropertyOptional({ example: 86400, description: 'TTL in seconds (max 1 year)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31536000)
  ttl?: number;
}
