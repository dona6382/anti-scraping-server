import { 
  Injectable, 
  Logger, 
  BadRequestException,
  NotFoundException,
  Inject 
} from '@nestjs/common';
import { 
  ProcessPaymentDto, 
  RefundPaymentDto, 
  PaymentResponseDto,
  PaymentStatus,
  PaymentMethod,
  PaymentHistoryDto
} from './dto/payment.dto';
import { ICacheService } from '../../common/services/base-cache.service';
import { OrderService } from '../order/order.service';
import { OrderStatus } from '../order/dto/order.dto';

/**
 * Payment Service
 * 결제 관련 비즈니스 로직을 처리
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly CACHE_TTL = 3600; // 1 hour for payment records
  
  // 가상의 결제 게이트웨이 설정
  private readonly PAYMENT_GATEWAY_SUCCESS_RATE = 0.95; // 95% 성공률 시뮬레이션
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * 결제 처리
   */
  async processPayment(paymentData: ProcessPaymentDto): Promise<PaymentResponseDto> {
    // 주문 확인
    const order = await this.orderService.getOrder(paymentData.orderId);
    if (!order) {
      throw new NotFoundException(`Order ${paymentData.orderId} not found`);
    }

    // 결제 가능 상태 확인
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is not in payable state: ${order.status}`);
    }

    // 금액 검증
    if (Math.abs(order.totalAmount - paymentData.amount) > 0.01) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected: ${order.totalAmount}, Got: ${paymentData.amount}`
      );
    }

    // 결제 방법별 검증
    await this.validatePaymentMethod(paymentData);

    // 중복 결제 방지
    const existingPayment = await this.checkDuplicatePayment(paymentData.orderId);
    if (existingPayment) {
      this.logger.warn(`Duplicate payment attempt for order: ${paymentData.orderId}`);
      return existingPayment;
    }

    // 트랜잭션 ID 생성
    const transactionId = this.generateTransactionId();

    // 결제 처리 시작
    const payment: PaymentResponseDto = {
      transactionId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      method: paymentData.method,
      status: PaymentStatus.PROCESSING,
    };

    // 캐시에 처리 중 상태 저장
    await this.cachePayment(payment);

    try {
      // 결제 게이트웨이 호출 시뮬레이션
      const success = await this.callPaymentGateway(paymentData);
      
      if (success) {
        payment.status = PaymentStatus.COMPLETED;
        payment.processedAt = new Date();
        
        // 주문 상태 업데이트
        await this.orderService.updateOrderStatus(paymentData.orderId, OrderStatus.PROCESSING);
        
        this.logger.log(`Payment processed successfully: ${transactionId}`);
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = 'Payment gateway rejected the transaction';
        
        this.logger.warn(`Payment failed: ${transactionId}`);
      }
    } catch (error) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = error.message;
      
      this.logger.error(`Payment processing error: ${transactionId}`, error);
    }

    // 최종 상태 캐시 업데이트
    await this.cachePayment(payment);

    // 결제 이력 업데이트
    await this.updatePaymentHistory(order.userId, payment);

    return payment;
  }

  /**
   * 환불 처리
   */
  async refundPayment(refundData: RefundPaymentDto): Promise<PaymentResponseDto> {
    // 원 거래 조회
    const originalPayment = await this.getPayment(refundData.transactionId);
    if (!originalPayment) {
      throw new NotFoundException(`Transaction ${refundData.transactionId} not found`);
    }

    // 환불 가능 상태 확인
    if (originalPayment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    // 환불 금액 검증
    const totalRefunded = (originalPayment.refundedAmount || 0) + refundData.amount;
    if (totalRefunded > originalPayment.amount) {
      throw new BadRequestException(
        `Refund amount exceeds original payment. Max refundable: ${originalPayment.amount - (originalPayment.refundedAmount || 0)}`
      );
    }

    // 환불 처리 시뮬레이션
    const refundSuccess = await this.processRefundWithGateway(originalPayment, refundData);
    
    if (refundSuccess) {
      originalPayment.refundedAmount = totalRefunded;
      
      // 전액 환불인 경우
      if (totalRefunded >= originalPayment.amount) {
        originalPayment.status = PaymentStatus.REFUNDED;
        
        // 주문 취소 처리
        await this.orderService.cancelOrder(originalPayment.orderId, 'Payment refunded');
      }
      
      // 캐시 업데이트
      await this.cachePayment(originalPayment);
      
      this.logger.log(`Refund processed: ${refundData.transactionId}, Amount: ${refundData.amount}`);
    } else {
      throw new BadRequestException('Refund processing failed');
    }

    return originalPayment;
  }

  /**
   * 결제 조회
   */
  async getPayment(transactionId: string): Promise<PaymentResponseDto | null> {
    const cacheKey = `payment:${transactionId}`;
    const cached = await this.cache.get<PaymentResponseDto>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // 실제로는 DB 조회
    // 여기서는 null 반환 (not found)
    return null;
  }

  /**
   * 사용자 결제 이력 조회
   */
  async getPaymentHistory(userId: string): Promise<PaymentHistoryDto> {
    const cacheKey = `payment:history:${userId}`;
    const cached = await this.cache.get<PaymentHistoryDto>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // 실제로는 DB에서 조회
    const history: PaymentHistoryDto = {
      userId,
      transactions: [],
      totalSpent: 0,
      currency: 'USD' as any,
    };

    // 캐시 저장
    await this.cache.set(cacheKey, history, this.CACHE_TTL);
    
    return history;
  }

  // ===== Private Helper Methods =====

  /**
   * 결제 방법 검증
   */
  private async validatePaymentMethod(paymentData: ProcessPaymentDto): Promise<void> {
    switch (paymentData.method) {
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        if (!paymentData.cardDetails) {
          throw new BadRequestException('Card details are required');
        }
        this.validateCardDetails(paymentData.cardDetails);
        break;
        
      case PaymentMethod.PAYPAL:
        if (!paymentData.paypalEmail) {
          throw new BadRequestException('PayPal email is required');
        }
        break;
        
      case PaymentMethod.CRYPTO:
        if (!paymentData.cryptoWallet) {
          throw new BadRequestException('Crypto wallet address is required');
        }
        break;
    }
  }

  /**
   * 카드 정보 검증
   */
  private validateCardDetails(cardDetails: any): void {
    // 만료일 확인
    const [month, year] = cardDetails.expiryDate.split('/');
    const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
    
    if (expiryDate < new Date()) {
      throw new BadRequestException('Card has expired');
    }

    // 카드 번호 Luhn 알고리즘 검증 (간단한 버전)
    if (!this.validateLuhn(cardDetails.cardNumber.replace(/\s/g, ''))) {
      throw new BadRequestException('Invalid card number');
    }
  }

  /**
   * Luhn 알고리즘 검증
   */
  private validateLuhn(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  /**
   * 중복 결제 확인
   */
  private async checkDuplicatePayment(orderId: string): Promise<PaymentResponseDto | null> {
    const cacheKey = `payment:order:${orderId}`;
    return await this.cache.get<PaymentResponseDto>(cacheKey);
  }

  /**
   * 트랜잭션 ID 생성
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11).toUpperCase();
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * 결제 캐싱
   */
  private async cachePayment(payment: PaymentResponseDto): Promise<void> {
    // 트랜잭션 ID로 캐싱
    await this.cache.set(`payment:${payment.transactionId}`, payment, this.CACHE_TTL);
    
    // 주문 ID로도 캐싱 (중복 방지용)
    if (payment.status === PaymentStatus.COMPLETED) {
      await this.cache.set(`payment:order:${payment.orderId}`, payment, this.CACHE_TTL);
    }
  }

  /**
   * 결제 게이트웨이 호출 시뮬레이션
   */
  private async callPaymentGateway(paymentData: ProcessPaymentDto): Promise<boolean> {
    // 실제로는 외부 API 호출
    // 여기서는 시뮬레이션
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() < this.PAYMENT_GATEWAY_SUCCESS_RATE;
        resolve(success);
      }, 1000 + Math.random() * 2000); // 1-3초 지연
    });
  }

  /**
   * 환불 게이트웨이 호출 시뮬레이션
   */
  private async processRefundWithGateway(
    originalPayment: PaymentResponseDto,
    refundData: RefundPaymentDto
  ): Promise<boolean> {
    // 실제로는 외부 API 호출
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true); // 환불은 항상 성공으로 시뮬레이션
      }, 500 + Math.random() * 1000);
    });
  }

  /**
   * 결제 이력 업데이트
   */
  private async updatePaymentHistory(userId: string, payment: PaymentResponseDto): Promise<void> {
    const cacheKey = `payment:history:${userId}`;
    const history = await this.getPaymentHistory(userId);
    
    history.transactions.push(payment);
    
    if (payment.status === PaymentStatus.COMPLETED) {
      history.totalSpent += payment.amount;
    }
    
    await this.cache.set(cacheKey, history, this.CACHE_TTL);
  }

  /**
   * 결제 재시도
   */
  async retryPayment(transactionId: string): Promise<PaymentResponseDto> {
    const payment = await this.getPayment(transactionId);
    
    if (!payment) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    
    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException('Only failed payments can be retried');
    }
    
    // 새로운 트랜잭션 ID로 재시도
    const newTransactionId = this.generateTransactionId();
    
    const newPayment: PaymentResponseDto = {
      ...payment,
      transactionId: newTransactionId,
      status: PaymentStatus.PROCESSING,
    };
    
    // 재시도 로직
    const success = await this.callPaymentGateway({
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
    } as ProcessPaymentDto);
    
    if (success) {
      newPayment.status = PaymentStatus.COMPLETED;
      newPayment.processedAt = new Date();
    } else {
      newPayment.status = PaymentStatus.FAILED;
    }
    
    await this.cachePayment(newPayment);
    
    return newPayment;
  }
}
