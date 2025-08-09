import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { CommonModule } from '../common/common.module';
import { ProductModule } from '../modules/product/product.module';
import { UserModule } from '../modules/user/user.module';
import { OrderModule } from '../modules/order/order.module';
import { PaymentModule } from '../modules/payment/payment.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';

/**
 * API Module
 * API 엔드포인트와 비즈니스 로직을 제공
 * 도메인 모듈들을 통합
 */
@Module({
  imports: [
    CommonModule,
    ProductModule,
    UserModule,
    OrderModule,
    PaymentModule,
    AnalyticsModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
  exports: [ApiService],
})
export class ApiModule {}
