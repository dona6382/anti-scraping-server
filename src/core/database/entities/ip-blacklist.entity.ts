import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * IP Blacklist Entity
 * IP 차단 정보 영구 저장
 */
@Entity('ip_blacklist')
@Index(['ip'])
@Index(['createdAt'])
export class IpBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'inet' })
  ip: string;

  @Column({ type: 'enum', enum: [
    'MANUAL_ADMIN_ACTION',
    'BOT_DETECTED', 
    'RATE_LIMIT_EXCEEDED',
    'SUSPICIOUS_BEHAVIOR',
    'HONEYPOT_TRIGGERED',
    'INVALID_USER_AGENT',
    'HEADLESS_BROWSER_DETECTED',
  ]})
  reason: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ default: 1 })
  violationCount: number;

  @Column({ default: true })
  isActive: boolean;

  // Who blocked this IP (optional)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'blockedByUserId' })
  blockedBy?: User;

  @Column({ type: 'uuid', nullable: true })
  blockedByUserId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Additional metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    userAgent?: string;
    endpoint?: string;
    country?: string;
    city?: string;
    isp?: string;
  };
}
