import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Security Event Entity
 * 보안 이벤트 로그 저장
 */
@Entity('security_events')
@Index(['createdAt'])
@Index(['eventType'])
@Index(['ip'])
@Index(['severity', 'createdAt'])
@Index(['eventType', 'severity'])
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: [
      'IP_BLOCKED',
      'IP_UNBLOCKED',
      'BOT_DETECTED',
      'RATE_LIMITED',
      'HONEYPOT_TRIGGERED',
      'USER_AGENT_BLOCKED',
      'HEADLESS_BROWSER_DETECTED',
      'SUSPICIOUS_ACTIVITY',
      'ADMIN_ACTION',
      'SYSTEM_ALERT',
      'AUTO_BLOCKED',
    ],
  })
  eventType: string;

  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  severity: string;

  @Column({ type: 'inet', nullable: true })
  ip?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ length: 500, nullable: true })
  endpoint?: string;

  @Column({ length: 20, nullable: true })
  method?: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  // Additional event data
  @Column({ type: 'json', nullable: true })
  eventData?: {
    requestId?: string;
    responseCode?: number;
    processingTime?: number;
    blockedReason?: string;
    location?: {
      country?: string;
      city?: string;
      region?: string;
    };
    clientInfo?: {
      browser?: string;
      os?: string;
      deviceType?: string;
    };
  };

  // Response actions taken
  @Column({ type: 'json', nullable: true })
  actions?: {
    blocked: boolean;
    notified: boolean;
    escalated: boolean;
    autoResolved: boolean;
  };
}
