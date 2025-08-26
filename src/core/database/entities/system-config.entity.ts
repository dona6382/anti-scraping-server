import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * System Config Entity
 * 동적 시스템 설정 저장
 */
@Entity('system_config')
@Index(['key'], { unique: true })
@Index(['category'])
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  @Index()
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ length: 50, default: 'general' })
  @Index()
  category: string;

  @Column({ type: 'enum', enum: ['string', 'number', 'boolean', 'json'], default: 'string' })
  valueType: 'string' | 'number' | 'boolean' | 'json';

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isReadonly: boolean;

  @Column({ default: false })
  requiresRestart: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Validation rules
  @Column({ type: 'json', nullable: true })
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedValues?: string[];
  };

  // Environment restrictions
  @Column({ type: 'simple-array', nullable: true })
  allowedEnvironments?: string[]; // ['development', 'staging', 'production']
}
