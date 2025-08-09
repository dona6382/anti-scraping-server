import { Injectable } from '@nestjs/common';
import { ProductService } from '../modules/product/product.service';
import { UserService } from '../modules/user/user.service';
import { OrderService } from '../modules/order/order.service';
import { PaymentService } from '../modules/payment/payment.service';
import { AnalyticsService } from '../modules/analytics/analytics.service';

/**
 * API Facade Service
 * 도메인 서비스들을 통합하여 제공하는 Facade 패턴
 * 하위 호환성을 위해 유지
 */
@Injectable()
export class ApiService {
  constructor(
    private readonly productService: ProductService,
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ===== Product Domain =====
  async getProducts(page: number, limit: number) {
    return this.productService.getProducts({ page, limit });
  }

  async getProduct(id: string) {
    const product = await this.productService.getProduct(id);
    return {
      status: 'success',
      data: product,
    };
  }

  async getPricingData(category?: string) {
    return this.productService.getPricingData(category);
  }

  async getInventory(productId?: string) {
    return this.productService.getInventory(productId);
  }

  // ===== User Domain =====
  async getUserProfile(id: string) {
    const profile = await this.userService.getUserProfile(id);
    return {
      status: 'success',
      data: profile,
    };
  }

  async updateUser(id: string, userData: any) {
    return this.userService.updateUser(id, userData);
  }

  async deleteUser(id: string, confirmData: any) {
    return this.userService.deleteUser(id, confirmData);
  }

  // ===== Order Domain =====
  async createOrder(orderData: any) {
    const order = await this.orderService.createOrder(orderData);
    return {
      status: 'success',
      message: 'Order created successfully',
      data: order,
    };
  }

  async getOrders(userId: string) {
    return this.orderService.getOrders({ userId });
  }

  // ===== Payment Domain =====
  async processPayment(paymentData: any) {
    const payment = await this.paymentService.processPayment(paymentData);
    return {
      status: 'success',
      message: 'Payment processed successfully',
      data: payment,
    };
  }

  // ===== Analytics Domain =====
  async exportAnalytics(exportRequest: any) {
    const report = await this.analyticsService.exportAnalytics(exportRequest);
    return {
      status: 'success',
      message: 'Export initiated. You will receive an email when ready.',
      data: report,
    };
  }
}
