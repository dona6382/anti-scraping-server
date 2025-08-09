import { 
  Injectable, 
  Logger, 
  NotFoundException, 
  BadRequestException,
  Inject 
} from '@nestjs/common';
import { 
  CreateOrderDto, 
  UpdateOrderDto, 
  OrderResponseDto, 
  OrderListResponseDto,
  OrderFilterDto,
  OrderStatus,
  OrderItemDto
} from './dto/order.dto';
import { ICacheService } from '../../common/services/base-cache.service';
import { ProductService } from '../product/product.service';
import { UserService } from '../user/user.service';

/**
 * Order Service
 * 주문 관련 비즈니스 로직을 처리
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly CACHE_TTL = 60; // 1 minute for orders

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly productService: ProductService,
    private readonly userService: UserService,
  ) {}

  /**
   * 주문 생성
   */
  async createOrder(orderData: CreateOrderDto): Promise<OrderResponseDto> {
    // 사용자 검증
    const userValidation = await this.userService.validateUser(orderData.userId);
    if (!userValidation.isValid) {
      throw new BadRequestException(`User validation failed: ${userValidation.errors?.join(', ')}`);
    }

    // 재고 확인 및 가격 계산
    const validatedItems = await this.validateOrderItems(orderData.items);
    const totalAmount = this.calculateTotalAmount(validatedItems);

    // 주문 ID 생성
    const orderId = this.generateOrderId();

    // 주문 생성 (실제로는 DB 저장)
    const order: OrderResponseDto = {
      orderId,
      userId: orderData.userId,
      items: validatedItems,
      totalAmount,
      status: OrderStatus.PENDING,
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress,
      notes: orderData.notes,
      createdAt: new Date(),
    };

    // 캐시 저장
    await this.cacheOrder(order);

    // 재고 차감
    await this.updateInventoryForOrder(validatedItems);

    // 이벤트 발행 (실제로는 EventEmitter 또는 Message Queue)
    this.publishOrderCreatedEvent(order);

    this.logger.log(`Order created: ${orderId} for user: ${orderData.userId}`);
    
    return order;
  }

  /**
   * 주문 목록 조회
   */
  async getOrders(filter: OrderFilterDto): Promise<OrderListResponseDto> {
    const { userId, status, page = 1, limit = 10 } = filter;
    
    // 캐시 키 생성
    const cacheKey = `orders:${userId || 'all'}:${status || 'all'}:${page}:${limit}`;
    
    // 캐시 확인
    const cached = await this.cache.get<OrderListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for orders: ${cacheKey}`);
      return cached;
    }

    // 실제로는 DB 조회
    const orders = await this.fetchOrdersFromDatabase(filter);
    
    const response: OrderListResponseDto = {
      status: 'success',
      count: orders.length,
      data: orders,
    };

    // 캐시 저장
    await this.cache.set(cacheKey, response, this.CACHE_TTL);
    
    this.logger.log(`Retrieved ${orders.length} orders`);
    return response;
  }

  /**
   * 주문 상세 조회
   */
  async getOrder(orderId: string): Promise<OrderResponseDto> {
    // 캐시 확인
    const cacheKey = `order:${orderId}`;
    const cached = await this.cache.get<OrderResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // 실제로는 DB 조회
    const order = await this.fetchOrderFromDatabase(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // 캐시 저장
    await this.cache.set(cacheKey, order, this.CACHE_TTL);
    
    return order;
  }

  /**
   * 주문 상태 업데이트
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderResponseDto> {
    const order = await this.getOrder(orderId);
    
    // 상태 전환 검증
    if (!this.isValidStatusTransition(order.status, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${status}`
      );
    }

    // 업데이트
    order.status = status;
    order.updatedAt = new Date();

    // 캐시 업데이트
    await this.cacheOrder(order);

    // 상태별 후처리
    await this.handleStatusChange(order, status);

    this.logger.log(`Order ${orderId} status updated to ${status}`);
    
    return order;
  }

  /**
   * 주문 취소
   */
  async cancelOrder(orderId: string, reason?: string): Promise<OrderResponseDto> {
    const order = await this.getOrder(orderId);
    
    // 취소 가능 상태 확인
    if (!this.isCancellable(order.status)) {
      throw new BadRequestException(`Order in ${order.status} status cannot be cancelled`);
    }

    // 상태 업데이트
    order.status = OrderStatus.CANCELLED;
    order.updatedAt = new Date();
    if (reason) {
      order.notes = `${order.notes ? order.notes + ' | ' : ''}Cancellation reason: ${reason}`;
    }

    // 재고 복원
    await this.restoreInventoryForOrder(order.items);

    // 캐시 업데이트
    await this.cacheOrder(order);

    this.logger.warn(`Order ${orderId} cancelled`);
    
    return order;
  }

  // ===== Private Helper Methods =====

  /**
   * 주문 항목 검증
   */
  private async validateOrderItems(items: OrderItemDto[]): Promise<OrderItemDto[]> {
    const validatedItems: OrderItemDto[] = [];
    
    for (const item of items) {
      // 제품 존재 확인
      const product = await this.productService.getProduct(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      
      // 재고 확인
      const inventory = await this.productService.getInventory(item.productId);
      if (inventory.status === 'success' && inventory.data) {
        const inv = Array.isArray(inventory.data) ? inventory.data[0] : inventory.data;
        if (inv.available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}. Available: ${inv.available}`
          );
        }
      }
      
      // 가격 검증 (실제 가격과 비교)
      validatedItems.push({
        ...item,
        price: product.price, // 실제 가격으로 덮어쓰기
      });
    }
    
    return validatedItems;
  }

  /**
   * 총액 계산
   */
  private calculateTotalAmount(items: OrderItemDto[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  /**
   * 주문 ID 생성
   */
  private generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * 주문 캐싱
   */
  private async cacheOrder(order: OrderResponseDto): Promise<void> {
    const cacheKey = `order:${order.orderId}`;
    await this.cache.set(cacheKey, order, this.CACHE_TTL);
    
    // 사용자별 주문 목록 캐시 무효화
    await this.invalidateOrderListCache(order.userId);
  }

  /**
   * 주문 목록 캐시 무효화
   */
  private async invalidateOrderListCache(userId: string): Promise<void> {
    // 패턴 매칭으로 관련 캐시 삭제
    const pattern = `orders:${userId}:*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.deleteMany(keys);
    }
  }

  /**
   * 재고 차감
   */
  private async updateInventoryForOrder(items: OrderItemDto[]): Promise<void> {
    for (const item of items) {
      await this.productService.updateInventory(item.productId, -item.quantity);
    }
  }

  /**
   * 재고 복원
   */
  private async restoreInventoryForOrder(items: OrderItemDto[]): Promise<void> {
    for (const item of items) {
      await this.productService.updateInventory(item.productId, item.quantity);
    }
  }

  /**
   * 상태 전환 유효성 검증
   */
  private isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };
    
    return transitions[from]?.includes(to) || false;
  }

  /**
   * 취소 가능 여부 확인
   */
  private isCancellable(status: OrderStatus): boolean {
    return [
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
      OrderStatus.CONFIRMED,
    ].includes(status);
  }

  /**
   * 상태 변경 후처리
   */
  private async handleStatusChange(order: OrderResponseDto, newStatus: OrderStatus): Promise<void> {
    switch (newStatus) {
      case OrderStatus.CONFIRMED:
        // 결제 확인 처리
        this.logger.log(`Payment confirmed for order ${order.orderId}`);
        break;
      case OrderStatus.SHIPPED:
        // 배송 알림 발송
        this.logger.log(`Shipment notification sent for order ${order.orderId}`);
        break;
      case OrderStatus.DELIVERED:
        // 배송 완료 처리
        this.logger.log(`Delivery completed for order ${order.orderId}`);
        break;
      case OrderStatus.REFUNDED:
        // 환불 처리
        this.logger.log(`Refund processed for order ${order.orderId}`);
        break;
    }
  }

  /**
   * 주문 생성 이벤트 발행
   */
  private publishOrderCreatedEvent(order: OrderResponseDto): void {
    // 실제로는 EventEmitter 또는 Message Queue 사용
    this.logger.log(`Order created event published: ${order.orderId}`);
  }

  /**
   * DB에서 주문 목록 조회 (시뮬레이션)
   */
  private async fetchOrdersFromDatabase(filter: OrderFilterDto): Promise<OrderResponseDto[]> {
    const { userId, status, page = 1, limit = 10 } = filter;
    const orders: OrderResponseDto[] = [];
    
    // 시뮬레이션 데이터 생성
    const count = Math.min(Math.floor(Math.random() * 5) + 1, limit);
    
    for (let i = 0; i < count; i++) {
      const orderId = `ORD-${Date.now()}-${i}`;
      orders.push({
        orderId,
        userId: userId || `user_${Math.floor(Math.random() * 100)}`,
        items: [
          {
            productId: `PROD-${Math.floor(Math.random() * 10) + 1}`,
            quantity: Math.floor(Math.random() * 3) + 1,
            price: Math.floor(Math.random() * 10000) / 100,
          },
        ],
        totalAmount: Math.floor(Math.random() * 100000) / 100,
        status: status || this.getRandomStatus(),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      });
    }
    
    return orders;
  }

  /**
   * DB에서 주문 조회 (시뮬레이션)
   */
  private async fetchOrderFromDatabase(orderId: string): Promise<OrderResponseDto | null> {
    if (!orderId.startsWith('ORD-')) {
      return null;
    }
    
    return {
      orderId,
      userId: `user_${Math.floor(Math.random() * 100)}`,
      items: [
        {
          productId: `PROD-1`,
          quantity: 2,
          price: 99.99,
        },
      ],
      totalAmount: 199.98,
      status: OrderStatus.PROCESSING,
      createdAt: new Date(),
    };
  }

  /**
   * 랜덤 상태 생성
   */
  private getRandomStatus(): OrderStatus {
    const statuses = Object.values(OrderStatus);
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}
