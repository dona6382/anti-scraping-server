import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * User Entity
 * 사용자 정보 및 인증 관리
 */
@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  username: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string; // bcrypt hashed

  @Column({ length: 100, nullable: true })
  firstName?: string;

  @Column({ length: 100, nullable: true })
  lastName?: string;

  @Column({ type: 'enum', enum: ['admin', 'user', 'readonly'], default: 'user' })
  role: 'admin' | 'user' | 'readonly';

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'inet', nullable: true })
  lastLoginIp?: string;

  @Column({ type: 'json', nullable: true })
  preferences?: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property for full name
  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username;
  }
}
