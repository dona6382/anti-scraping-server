import { DomainEvent } from '../../common/events/event-bus.service';
import { OrderStatus } from '../../modules/order/dto/order.dto';
import { PaymentStatus, PaymentMethod } from '../../modules/payment/dto/payment.dto';

/**
 * Order Created Event
 * 주문이 생성되었을 때 발생
 */
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly items: Array<{ productId: string; quantity: number; price: number }>,
    metadata?: Record<string, any>
  ) {
    super('order.created', orderId, userId, metadata);
  }
}

/**
 * Order Status Changed Event
 * 주문 상태가 변경되었을 때 발생
 */
export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly oldStatus: OrderStatus,
    public readonly newStatus: OrderStatus,
    metadata?: Record<string, any>
  ) {
    super('order.status.changed', orderId, userId, metadata);
  }
}

/**
 * Order Cancelled Event
 * 주문이 취소되었을 때 발생
 */
export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly reason: string,
    metadata?: Record<string, any>
  ) {
    super('order.cancelled', orderId, userId, metadata);
  }
}

/**
 * Payment Processed Event
 * 결제가 처리되었을 때 발생
 */
export class PaymentProcessedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly status: PaymentStatus,
    public readonly method: PaymentMethod,
    metadata?: Record<string, any>
  ) {
    super('payment.processed', transactionId, userId, metadata);
  }
}

/**
 * Payment Failed Event
 * 결제가 실패했을 때 발생
 */
export class PaymentFailedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly orderId: string,
    public readonly userId: string,
    public readonly reason: string,
    metadata?: Record<string, any>
  ) {
    super('payment.failed', transactionId, userId, metadata);
  }
}

/**
 * User Registered Event
 * 사용자가 등록되었을 때 발생
 */
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username: string,
    metadata?: Record<string, any>
  ) {
    super('user.registered', userId, userId, metadata);
  }
}

/**
 * User Deleted Event
 * 사용자가 삭제되었을 때 발생
 */
export class UserDeletedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    metadata?: Record<string, any>
  ) {
    super('user.deleted', userId, userId, metadata);
  }
}

/**
 * Inventory Updated Event
 * 재고가 업데이트되었을 때 발생
 */
export class InventoryUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly oldQuantity: number,
    public readonly newQuantity: number,
    public readonly reason: string,
    metadata?: Record<string, any>
  ) {
    super('inventory.updated', productId, undefined, metadata);
  }
}

/**
 * Low Stock Alert Event
 * 재고가 부족할 때 발생
 */
export class LowStockAlertEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly currentStock: number,
    public readonly threshold: number,
    metadata?: Record<string, any>
  ) {
    super('inventory.low.stock', productId, undefined, metadata);
  }
}

/**
 * Security Threat Detected Event
 * 보안 위협이 감지되었을 때 발생
 */
export class SecurityThreatDetectedEvent extends DomainEvent {
  constructor(
    public readonly threatType: string,
    public readonly ipAddress: string,
    public readonly details: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    super('security.threat.detected', ipAddress, undefined, { ...details, ...metadata });
  }
}

/**
 * Analytics Export Completed Event
 * 분석 데이터 내보내기가 완료되었을 때 발생
 */
export class AnalyticsExportCompletedEvent extends DomainEvent {
  constructor(
    public readonly exportId: string,
    public readonly userId: string,
    public readonly downloadUrl: string,
    public readonly format: string,
    metadata?: Record<string, any>
  ) {
    super('analytics.export.completed', exportId, userId, metadata);
  }
}
