/**
 * Auth DTO (for login)
 */
export class AuthDto {
  username: string;
  password: string;
}

/**
 * Login DTO (alias for AuthDto)
 */
export class LoginDto extends AuthDto {}

/**
 * Register DTO
 */
export class RegisterDto {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Create User DTO (extends RegisterDto with role)
 */
export class CreateUserDto extends RegisterDto {
  role?: 'admin' | 'user' | 'readonly';
}

/**
 * Change Password DTO
 */
export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Update Profile DTO
 */
export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  preferences?: {
    theme?: 'light' | 'dark';
    language?: string;
    notifications?: boolean;
  };
}
