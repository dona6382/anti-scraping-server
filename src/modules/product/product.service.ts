import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { 
  GetProductsDto, 
  ProductResponseDto, 
  ProductListResponseDto,
  PricingDataDto,
  InventoryDataDto,
  InventoryResponseDto
} from './dto/product.dto';
import { 
  IProductRepository,
  IInventoryRepository 
} from '../../core/domain/repositories/product.repository.interface';

/**
 * Product Service (Repository Pattern Applied)
 * 제품 관련 비즈니스 로직을 처리
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @Inject('IProductRepository') 
    private readonly productRepository: IProductRepository,
    @Inject('IInventoryRepository') 
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  /**
   * 제품 목록 조회
   */
  async getProducts(dto: GetProductsDto): Promise<ProductListResponseDto> {
    const { page = 1, limit = 10, category, sortBy } = dto;
    
    // Repository를 통한 데이터 조회
    const result = await this.productRepository.findPaginated(
      { category },
      { page, limit, sortBy: sortBy as string }
    );

    // Entity를 DTO로 변환
    const products: ProductResponseDto[] = result.data.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      inStock: product.inStock,
      specifications: {
        weight: '1.5kg',
        dimensions: '30x20x10cm',
        material: 'Premium quality',
      },
    }));

    this.logger.log(`Retrieved ${products.length} products for page ${page}`);
    
    return {
      status: 'success',
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: products,
    };
  }

  /**
   * 제품 상세 조회
   */
  async getProduct(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findById(id);
    
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    this.logger.log(`Retrieved product: ${id}`);
    
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      inStock: product.inStock,
      specifications: {
        weight: '1.5kg',
        dimensions: '30x20x10cm',
        material: 'Premium quality',
      },
    };
  }

  /**
   * 가격 데이터 조회
   */
  async getPricingData(category?: string): Promise<{ status: string; data: PricingDataDto[] }> {
    const products = category 
      ? await this.productRepository.findByCategory(category)
      : await this.productRepository.findAll();

    const pricing: PricingDataDto[] = products.map(product => ({
      productId: product.id,
      category: product.category || 'general',
      basePrice: product.price,
      discountPrice: product.price * 0.8,
      currency: 'USD',
      lastUpdated: product.updatedAt,
    }));

    this.logger.log(`Retrieved pricing data for category: ${category || 'all'}`);
    
    return {
      status: 'success',
      data: pricing,
    };
  }

  /**
   * 재고 현황 조회
   */
  async getInventory(productId?: string): Promise<InventoryResponseDto> {
    if (productId) {
      const inventory = await this.inventoryRepository.getByProductId(productId);
      
      if (!inventory) {
        throw new NotFoundException(`Inventory for product ${productId} not found`);
      }

      return {
        status: 'success',
        data: {
          productId: inventory.productId,
          quantity: inventory.quantity,
          reserved: inventory.reserved,
          available: inventory.available,
          lastRestocked: inventory.lastRestocked,
        },
      };
    }

    const inventories = await this.inventoryRepository.getAll();
    const data: InventoryDataDto[] = inventories.map(inv => ({
      productId: inv.productId,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: inv.available,
      lastRestocked: inv.lastRestocked,
    }));

    return {
      status: 'success',
      count: data.length,
      data,
    };
  }

  /**
   * 재고 업데이트
   */
  async updateInventory(productId: string, quantity: number): Promise<void> {
    const success = await this.inventoryRepository.updateQuantity(productId, quantity);
    
    if (!success) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // 제품 재고 상태 업데이트
    const inventory = await this.inventoryRepository.getByProductId(productId);
    if (inventory) {
      await this.productRepository.update(productId, {
        stockQuantity: inventory.quantity,
        inStock: inventory.available > 0,
      });
    }

    this.logger.log(`Inventory updated for product ${productId}: ${quantity}`);
  }

  /**
   * 재고 예약
   */
  async reserveStock(productId: string, quantity: number): Promise<boolean> {
    return await this.inventoryRepository.reserveStock(productId, quantity);
  }

  /**
   * 재고 예약 해제
   */
  async releaseStock(productId: string, quantity: number): Promise<boolean> {
    return await this.inventoryRepository.releaseReservation(productId, quantity);
  }

  /**
   * 재고 부족 제품 조회
   */
  async getLowStockProducts(threshold: number = 10): Promise<InventoryDataDto[]> {
    const lowStock = await this.inventoryRepository.getLowStock(threshold);
    
    return lowStock.map(inv => ({
      productId: inv.productId,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: inv.available,
      lastRestocked: inv.lastRestocked,
    }));
  }

  /**
   * 인기 상품 조회
   */
  async getTopSellingProducts(limit: number = 10): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.getTopSelling(limit);
    
    return products.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      inStock: product.inStock,
    }));
  }
}
