import {
  IsIP,
  IsEnum,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsString,
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

export class CidrBlockDto {
  @ApiProperty({ example: '192.168.0.0/24', description: 'CIDR range to block' })
  @IsNotEmpty()
  @IsString()
  cidr: string;

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
