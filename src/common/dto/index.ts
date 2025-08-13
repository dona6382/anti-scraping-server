import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength, MaxLength, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base Response DTO
 */
export class BaseResponseDto<T = unknown> {
  @ApiProperty({ example: 'success' })
  status: 'success' | 'error';

  @ApiProperty()
  data: T;

  @ApiPropertyOptional()
  message?: string | undefined;

  @ApiProperty({ example: '2025-08-13T12:00:00.000Z' })
  timestamp: string;

  constructor(data: T, message?: string | undefined) {
    this.status = 'success';
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error Response DTO
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 'error' })
  status: 'error';

  @ApiProperty({ example: 'Request validation failed' })
  message: string;

  @ApiPropertyOptional({ example: 'VALIDATION_ERROR' })
  code?: string | undefined;

  @ApiProperty({ example: '2025-08-13T12:00:00.000Z' })
  timestamp: string;

  @ApiPropertyOptional()
  details?: unknown;

  constructor(message: string, code?: string | undefined, details?: unknown) {
    this.status = 'error';
    this.message = message;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.details = details;
  }
}

/**
 * Contact Form DTO
 */
export class ContactRequestDto {
  @ApiProperty({ 
    description: 'Contact person name',
    example: 'John Doe',
    minLength: 1,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name!: string; // 확정 할당 단언 추가

  @ApiProperty({ 
    description: 'Contact email address',
    example: 'john.doe@example.com'
  })
  @IsEmail()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string; // 확정 할당 단언 추가

  @ApiProperty({ 
    description: 'Contact message',
    example: 'I would like to know more about your service',
    minLength: 10,
    maxLength: 2000
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  message!: string; // 확정 할당 단언 추가

  @ApiPropertyOptional({ 
    description: 'reCAPTCHA token for bot protection',
    example: 'reCAPTCHA_token_here'
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  // Honeypot fields (hidden from documentation)
  @IsOptional()
  @IsString()
  email_confirm?: string;

  @IsOptional()
  @IsString()
  _timestamp?: string;

  @IsOptional()
  @IsString()
  _jsToken?: string;
}

export class ContactResponseDto {
  @ApiProperty({ example: 'CONTACT-1692025200000-ABC12' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ example: '2025-08-13T12:00:00.000Z' })
  submittedAt: string;

  constructor(id: string, name: string, email: string, message: string) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.message = message;
    this.submittedAt = new Date().toISOString();
  }
}

/**
 * Critical Action DTO
 */
export class CriticalActionRequestDto {
  @ApiProperty({ 
    description: 'Action to perform',
    example: 'reset_password',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  action!: string; // 확정 할당 단언 추가

  @ApiPropertyOptional({ 
    description: 'Action parameters',
    example: { userId: 123, force: true }
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ 
    description: 'reCAPTCHA token for bot protection'
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  // Honeypot fields
  @IsOptional()
  @IsString()
  email_confirm?: string;

  @IsOptional()
  @IsString()
  _timestamp?: string;

  @IsOptional()
  @IsString()
  _jsToken?: string;
}

export class CriticalActionResponseDto {
  @ApiProperty({ example: 'ACTION-1692025200000-XYZ89' })
  id: string;

  @ApiProperty({ example: 'reset_password' })
  action: string;

  @ApiProperty({ example: 'completed' })
  status: 'completed' | 'pending' | 'failed';

  @ApiProperty({ example: '2025-08-13T12:00:00.000Z' })
  timestamp: string;

  constructor(id: string, action: string, status: 'completed' | 'pending' | 'failed' = 'completed') {
    this.id = id;
    this.action = action;
    this.status = status;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Test DTO
 */
export class TestRequestDto {
  @ApiPropertyOptional({ description: 'Test data' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Test email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Test message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'reCAPTCHA token' })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  @ApiPropertyOptional({ description: 'Browser properties for headless detection' })
  @IsOptional()
  @IsObject()
  _browserProps?: {
    webdriver?: boolean;
    languages?: string[];
    plugins?: string[];
    userAgent?: string;
  };

  // Honeypot fields
  @IsOptional()
  @IsString()
  email_confirm?: string;

  @IsOptional()
  @IsString()
  _timestamp?: string;

  @IsOptional()
  @IsString()
  _jsToken?: string;
}

/**
 * Admin DTO
 */
export class BlacklistIpRequestDto {
  @ApiProperty({ 
    description: 'IP address to blacklist',
    example: '192.168.1.100'
  })
  @IsString()
  @IsNotEmpty()
  ip!: string; // 확정 할당 단언 추가

  @ApiPropertyOptional({ 
    description: 'Reason for blacklisting',
    example: 'Suspicious activity detected'
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({ 
    description: 'Time to live in seconds',
    example: 86400
  })
  @IsOptional()
  ttl?: number;
}

/**
 * Sample Data DTO
 */
export interface SampleItem {
  id: number;
  name: string;
  value: number;
}

export interface SearchResult {
  id: number;
  title: string;
  score: number;
  url: string;
}

export class SearchResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'typescript' })
  query: string;

  @ApiProperty({ type: 'array' })
  results: SearchResult[];

  @ApiProperty({ example: '2025-08-13T12:00:00.000Z' })
  timestamp: string;

  constructor(query: string, results: SearchResult[]) {
    this.status = 'success';
    this.query = query;
    this.results = results;
    this.timestamp = new Date().toISOString();
  }
}
