/**
 * Login DTO
 */
export class LoginDto {
  username: string;
  password: string;
}

/**
 * Create User DTO
 */
export class CreateUserDto {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
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
