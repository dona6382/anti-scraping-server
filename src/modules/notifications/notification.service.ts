import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
  PaymentProcessedEvent,
  PaymentFailedEvent,
  UserRegisteredEvent,
  UserDeletedEvent,
  LowStockAlertEvent,
  SecurityThreatDetectedEvent,
  AnalyticsExportCompletedEvent,
} from '../../common/events/domain-events';
import { SafeEventHandler } from '../../common/events/event-bus.service';

/**
 * Notification Service
 * 도메인 이벤트를 구독하여 알림을 발송
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * 주문 생성 알림
   */
  @SafeEventHandler('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`Sending order confirmation email for order: ${event.orderId}`);
    
    // 이메일 발송 로직
    await this.sendEmail(
      event.userId,
      'Order Confirmation',
      `Your order ${event.orderId} has been received. Total: $${event.totalAmount}`
    );
    
    // SMS 알림 (옵션)
    if (event.metadata?.sendSms) {
      await this.sendSms(event.userId, `Order ${event.orderId} confirmed!`);
    }
  }

  /**
   * 주문 상태 변경 알림
   */
  @SafeEventHandler('order.status.changed')
  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const statusMessages = {
      'processing': 'Your order is being processed',
      'shipped': 'Your order has been shipped',
      'delivered': 'Your order has been delivered',
    };
    
    const message = statusMessages[event.newStatus] || `Order status: ${event.newStatus}`;
    
    await this.sendEmail(
      event.userId,
      'Order Status Update',
      `Order ${event.orderId}: ${message}`
    );
  }

  /**
   * 결제 처리 알림
   */
  @SafeEventHandler('payment.processed')
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    if (event.status === 'completed') {
      await this.sendEmail(
        event.userId,
        'Payment Successful',
        `Payment of $${event.amount} for order ${event.orderId} was successful.`
      );
    }
  }

  /**
   * 결제 실패 알림
   */
  @SafeEventHandler('payment.failed')
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.sendEmail(
      event.userId,
      'Payment Failed',
      `Payment for order ${event.orderId} failed: ${event.reason}`
    );
    
    // 관리자에게도 알림
    await this.notifyAdmin(
      'Payment Failure',
      `Transaction ${event.transactionId} failed for user ${event.userId}`
    );
  }

  /**
   * 사용자 등록 환영 이메일
   */
  @SafeEventHandler('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.sendEmail(
      event.userId,
      'Welcome!',
      `Welcome ${event.username}! Thank you for registering.`
    );
    
    // 온보딩 이메일 시리즈 시작
    await this.scheduleOnboardingEmails(event.userId, event.email);
  }

  /**
   * 재고 부족 알림
   */
  @SafeEventHandler('inventory.low.stock')
  async handleLowStock(event: LowStockAlertEvent): Promise<void> {
    await this.notifyAdmin(
      'Low Stock Alert',
      `Product ${event.productId} has low stock: ${event.currentStock} units remaining`
    );
    
    // Slack 알림
    await this.sendSlackNotification(
      '#inventory-alerts',
      `⚠️ Low stock alert: Product ${event.productId} - Only ${event.currentStock} units left!`
    );
  }

  /**
   * 보안 위협 알림
   */
  @SafeEventHandler('security.threat.detected')
  async handleSecurityThreat(event: SecurityThreatDetectedEvent): Promise<void> {
    const severity = this.calculateSeverity(event.threatType);
    
    // 관리자 즉시 알림
    await this.notifyAdmin(
      `Security Alert - ${severity}`,
      `Threat detected: ${event.threatType} from IP ${event.ipAddress}`
    );
    
    // 심각도가 높은 경우 SMS 알림
    if (severity === 'CRITICAL') {
      await this.sendAdminSms(
        `CRITICAL SECURITY ALERT: ${event.threatType} detected`
      );
    }
    
    // 보안 팀 Slack 채널
    await this.sendSlackNotification(
      '#security-alerts',
      `🚨 ${severity} Alert: ${event.threatType}\nIP: ${event.ipAddress}\nDetails: ${JSON.stringify(event.details)}`
    );
  }

  /**
   * 분석 내보내기 완료 알림
   */
  @SafeEventHandler('analytics.export.completed')
  async handleAnalyticsExportCompleted(event: AnalyticsExportCompletedEvent): Promise<void> {
    await this.sendEmail(
      event.userId,
      'Analytics Export Ready',
      `Your analytics export is ready for download: ${event.downloadUrl}`
    );
  }

  /**
   * 모든 이벤트 로깅 (감사 목적)
   */
  @OnEvent('*')
  async handleAllEvents(event: any): Promise<void> {
    // 감사 로그
    this.logger.debug(`Event occurred: ${event.eventName}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      userId: event.userId,
      occurredAt: event.occurredAt,
    });
    
    // 실제로는 감사 로그 DB에 저장
    await this.saveAuditLog(event);
  }

  // ===== Private Helper Methods =====

  private async sendEmail(userId: string, subject: string, body: string): Promise<void> {
    // 실제 이메일 발송 로직
    this.logger.log(`Email sent to user ${userId}: ${subject}`);
  }

  private async sendSms(userId: string, message: string): Promise<void> {
    // 실제 SMS 발송 로직
    this.logger.log(`SMS sent to user ${userId}: ${message}`);
  }

  private async notifyAdmin(subject: string, message: string): Promise<void> {
    // 관리자 알림
    this.logger.warn(`Admin notification: ${subject} - ${message}`);
  }

  private async sendAdminSms(message: string): Promise<void> {
    // 관리자 SMS
    this.logger.error(`Admin SMS: ${message}`);
  }

  private async sendSlackNotification(channel: string, message: string): Promise<void> {
    // Slack 웹훅 호출
    this.logger.log(`Slack notification to ${channel}: ${message}`);
  }

  private async scheduleOnboardingEmails(userId: string, email: string): Promise<void> {
    // 온보딩 이메일 스케줄링
    this.logger.log(`Onboarding emails scheduled for ${email}`);
  }

  private async saveAuditLog(event: any): Promise<void> {
    // 감사 로그 저장
    // 실제로는 DB에 저장
  }

  private calculateSeverity(threatType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalThreats = ['ddos', 'sql_injection', 'brute_force'];
    const highThreats = ['suspicious_activity', 'rate_limit_exceeded'];
    
    if (criticalThreats.includes(threatType.toLowerCase())) return 'CRITICAL';
    if (highThreats.includes(threatType.toLowerCase())) return 'HIGH';
    
    return 'MEDIUM';
  }
}
