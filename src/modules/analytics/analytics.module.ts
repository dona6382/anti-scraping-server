import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CommonModule } from '../../common/common.module';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';

/**
 * Analytics Module
 * 분석 및 리포팅 기능을 제공하는 모듈
 */
@Module({
  imports: [
    CommonModule,
    OrderModule,
    ProductModule,
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
