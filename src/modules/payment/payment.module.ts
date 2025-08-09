import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CommonModule } from '../../common/common.module';
import { OrderModule } from '../order/order.module';

/**
 * Payment Module
 * 결제 관련 기능을 제공하는 모듈
 */
@Module({
  imports: [
    CommonModule,
    forwardRef(() => OrderModule), // 순환 의존성 해결
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
