import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { CommonModule } from '../../common/common.module';
import { 
  InMemoryProductRepository, 
  InMemoryInventoryRepository 
} from '../../core/infrastructure/repositories/product.repository';

/**
 * Product Module
 * 제품 관련 기능을 제공하는 모듈
 */
@Module({
  imports: [CommonModule],
  providers: [
    ProductService,
    // Repository Providers
    {
      provide: 'IProductRepository',
      useClass: InMemoryProductRepository,
    },
    {
      provide: 'IInventoryRepository',
      useClass: InMemoryInventoryRepository,
    },
  ],
  exports: [ProductService],
})
export class ProductModule {}
