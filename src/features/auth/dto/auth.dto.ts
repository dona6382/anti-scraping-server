import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Login DTO
 */
export class AuthDto {
  @ApiProperty({ example: 'admin', minLength: 3, maxLength: 50 })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

/**
 * Register DTO
 */
export class RegisterDto {
  @ApiProperty({ example: 'johndoe', minLength: 3, maxLength: 50 })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss1', minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  password: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

/**
 * Create User DTO (admin 용)
 */
export class CreateUserDto extends RegisterDto {
  @ApiPropertyOptional({ enum: ['admin', 'user', 'readonly'], default: 'user' })
  @IsOptional()
  @IsEnum(['admin', 'user', 'readonly'])
  role?: 'admin' | 'user' | 'readonly';
}

/**
 * Change Password DTO
 */
export class ChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  newPassword: string;
}
