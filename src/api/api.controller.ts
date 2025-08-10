import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

// Services
import { ApiService } from './api.service';

// Guards - 필요에 따라 선택적으로 적용
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';
import { HoneypotGuard } from '../common/guards/honeypot.guard';
import { RecaptchaGuard } from '../common/guards/recaptcha.guard';

/**
 * API Controller
 * 실제 비즈니스 로직을 처리하는 API 엔드포인트
 * 각 엔드포인트마다 필요한 보호 수준을 다르게 적용
 */
@Controller('api/v1')
@UseGuards(IpBlacklistGuard) // 모든 API 엔드포인트에 IP 블랙리스트 적용
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(private readonly apiService: ApiService) {}

  // ============================================
  // 공개 API (낮은 보호 수준)
  // ============================================

  /**
   * 샘플 사용자 데이터 조회 (테스트용)
   */
  @Get('sample/user')
  @UseGuards(UserAgentGuard)
  @Throttle({ default: { ttl: 60, limit: 50 } })
  async getSampleUserData() {
    this.logger.log('Sample user data requested');

    return this.apiService.getSampleUserData();
  }

  /**
   * 제품 목록 조회 (공개 데이터)
   */
  @Get('products')
  @UseGuards(UserAgentGuard)
  @Throttle({ default: { ttl: 60, limit: 30 } })
  async getProducts(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    this.logger.log(`Products requested - Page: ${page}, Limit: ${limit}`);

    return this.apiService.getProducts(page, limit);
  }

  /**
   * 제품 상세 조회
   */
  @Get('products/:id')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 20 } })
  async getProduct(@Param('id') id: string) {
    this.logger.log(`Product ${id} requested`);

    return this.apiService.getProduct(id);
  }

  // ============================================
  // 보호된 API (중간 보호 수준)
  // ============================================

  /**
   * 사용자 프로필 조회
   */
  @Get('users/:id')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 10 } })
  async getUserProfile(@Param('id') id: string) {
    this.logger.log(`User profile ${id} requested`);

    return this.apiService.getUserProfile(id);
  }

  /**
   * 주문 생성 (Honeypot + reCAPTCHA)
   */
  @Post('orders')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300, limit: 5 } })
  async createOrder(@Body() orderData: any) {
    this.logger.log('Order creation requested', {
      userId: orderData.userId,
      totalAmount: orderData.totalAmount,
    });

    // Honeypot과 reCAPTCHA 필드 제거
    const cleanedData = { ...orderData };
    delete cleanedData.email_confirm;
    delete cleanedData.recaptchaToken;
    delete cleanedData._timestamp;
    delete cleanedData._jsToken;
    delete cleanedData._browserProps;

    return this.apiService.createOrder(cleanedData);
  }

  /**
   * 주문 목록 조회
   */
  @Get('orders')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 15 } })
  async getOrders(@Query('userId') userId: string) {
    this.logger.log(`Orders requested for user: ${userId}`);

    return this.apiService.getOrders(userId);
  }

  // ============================================
  // 높은 보호 수준 API
  // ============================================

  /**
   * 결제 처리 (최대 보호)
   */
  @Post('payments')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 600, limit: 3 } })
  async processPayment(@Body() paymentData: any) {
    this.logger.warn('Payment processing requested', {
      orderId: paymentData.orderId,
      amount: paymentData.amount,
    });

    // 민감한 필드 제거
    const cleanedData = { ...paymentData };
    delete cleanedData.email_confirm;
    delete cleanedData.recaptchaToken;
    delete cleanedData._timestamp;
    delete cleanedData._jsToken;
    delete cleanedData._browserProps;

    return this.apiService.processPayment(cleanedData);
  }

  /**
   * 사용자 정보 수정
   */
  @Put('users/:id')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 300, limit: 5 } })
  async updateUser(@Param('id') id: string, @Body() userData: any) {
    this.logger.log(`User ${id} update requested`);

    return this.apiService.updateUser(id, userData);
  }

  /**
   * 계정 삭제 (최대 보호)
   */
  @Delete('users/:id')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, HoneypotGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 3600, limit: 1 } }) // 1시간에 1번만
  async deleteUser(@Param('id') id: string, @Body() confirmData: any) {
    this.logger.error(`User ${id} deletion requested`);

    return this.apiService.deleteUser(id, confirmData);
  }

  // ============================================
  // 데이터 분석 API (봇 차단 중요)
  // ============================================

  /**
   * 가격 데이터 조회 (스크래핑 대상)
   */
  @Get('pricing')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 120, limit: 10 } })
  async getPricingData(@Query('category') category?: string) {
    this.logger.log(`Pricing data requested for category: ${category || 'all'}`);

    return this.apiService.getPricingData(category);
  }

  /**
   * 재고 현황 조회
   */
  @Get('inventory')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard)
  @Throttle({ default: { ttl: 60, limit: 15 } })
  async getInventory(@Query('productId') productId?: string) {
    this.logger.log(`Inventory requested for product: ${productId || 'all'}`);

    return this.apiService.getInventory(productId);
  }

  /**
   * 분석 데이터 내보내기 (높은 보호)
   */
  @Post('analytics/export')
  @UseGuards(UserAgentGuard, HeadlessBrowserGuard, RecaptchaGuard)
  @Throttle({ default: { ttl: 1800, limit: 2 } }) // 30분에 2번
  async exportAnalytics(@Body() exportRequest: any) {
    this.logger.warn('Analytics export requested', {
      type: exportRequest.type,
      dateRange: exportRequest.dateRange,
    });

    return this.apiService.exportAnalytics(exportRequest);
  }
}
