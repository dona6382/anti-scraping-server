import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CommonModule } from '../../common/common.module';

/**
 * Notification Module
 * 알림 관련 기능을 제공하는 모듈
 */
@Module({
  imports: [CommonModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
