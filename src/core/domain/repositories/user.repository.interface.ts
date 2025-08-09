import { IPaginatedRepository } from './base.repository.interface';

/**
 * User Entity
 */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  profilePicture?: string;
  bio?: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  joinDate: Date;
  updatedAt: Date;
}

/**
 * User Repository Interface
 */
export interface IUserRepository extends IPaginatedRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateLastLogin(userId: string): Promise<boolean>;
  verifyEmail(userId: string): Promise<boolean>;
  deactivate(userId: string): Promise<boolean>;
  findActive(): Promise<User[]>;
  existsByEmail(email: string): Promise<boolean>;
  existsByUsername(username: string): Promise<boolean>;
}
