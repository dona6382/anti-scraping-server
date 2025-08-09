import { IsString, IsEmail, IsOptional, IsUUID, MinLength, MaxLength, IsObject } from 'class-validator';

/**
 * User DTOs
 * 사용자 관련 데이터 전송 객체
 */

export class UserProfileDto {
  id: string;
  username: string;
  email: string;
  joinDate: Date;
  lastActive: Date;
  profilePicture?: string;
  bio?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}

export class DeleteUserDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  confirmPhrase: string; // "DELETE MY ACCOUNT"
}

export class UserResponseDto {
  status: 'success' | 'error';
  message?: string;
  data?: UserProfileDto | Partial<UserProfileDto>;
  updatedAt?: Date;
  deletedAt?: Date;
}

export class UserValidationResult {
  isValid: boolean;
  userId?: string;
  errors?: string[];
}
