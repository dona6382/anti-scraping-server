import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { CommonModule } from '../../common/common.module';
import { ProductModule } from '../product/product.module';
import { UserModule } from '../user/user.module';

/**
 * Order Module
 * 주문 관련 기능을 제공하는 모듈
 */
@Module({
  imports: [
    CommonModule,
    ProductModule,
    UserModule,
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
