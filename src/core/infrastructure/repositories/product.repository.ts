import { Injectable, Inject } from '@nestjs/common';
import { 
  IProductRepository, 
  Product,
  IInventoryRepository,
  Inventory 
} from '../../domain/repositories/product.repository.interface';
import { 
  PaginationOptions, 
  PaginatedResult 
} from '../../domain/repositories/base.repository.interface';
import { ICacheService } from '../../../common/services/base-cache.service';

/**
 * In-Memory Product Repository
 * 실제로는 MongoDB, PostgreSQL 등으로 교체
 */
@Injectable()
export class InMemoryProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();
  private readonly CACHE_PREFIX = 'repo:product:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
  ) {
    this.seedData();
  }

  async findById(id: string): Promise<Product | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await this.cache.get<Product>(cacheKey);
    if (cached) return cached;

    const product = this.products.get(id) || null;
    if (product) {
      await this.cache.set(cacheKey, product, this.CACHE_TTL);
    }
    return product;
  }

  async findAll(filter?: any): Promise<Product[]> {
    let products = Array.from(this.products.values());
    
    if (filter?.category) {
      products = products.filter(p => p.category === filter.category);
    }
    if (filter?.inStock !== undefined) {
      products = products.filter(p => p.inStock === filter.inStock);
    }
    
    return products;
  }

  async findOne(filter: any): Promise<Product | null> {
    const products = await this.findAll(filter);
    return products[0] || null;
  }

  async create(entity: Product): Promise<Product> {
    const id = entity.id || this.generateId();
    const product: Product = {
      ...entity,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.products.set(id, product);
    await this.invalidateCache();
    
    return product;
  }

  async update(id: string, entity: Partial<Product>): Promise<Product | null> {
    const existing = this.products.get(id);
    if (!existing) return null;

    const updated: Product = {
      ...existing,
      ...entity,
      id, // ID는 변경 불가
      updatedAt: new Date(),
    };
    
    this.products.set(id, updated);
    await this.invalidateCache(id);
    
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.products.delete(id);
    if (result) {
      await this.invalidateCache(id);
    }
    return result;
  }

  async count(filter?: any): Promise<number> {
    const products = await this.findAll(filter);
    return products.length;
  }

  async exists(id: string): Promise<boolean> {
    return this.products.has(id);
  }

  async findPaginated(
    filter: any,
    options: PaginationOptions
  ): Promise<PaginatedResult<Product>> {
    const allProducts = await this.findAll(filter);
    const total = allProducts.length;
    
    // Sorting
    if (options.sortBy) {
      allProducts.sort((a, b) => {
        const aVal = a[options.sortBy as keyof Product];
        const bVal = b[options.sortBy as keyof Product];
        
        if (options.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    
    // Pagination
    const start = (options.page - 1) * options.limit;
    const end = start + options.limit;
    const data = allProducts.slice(start, end);
    
    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  async findByCategory(category: string): Promise<Product[]> {
    return this.findAll({ category });
  }

  async findInStock(): Promise<Product[]> {
    return this.findAll({ inStock: true });
  }

  async updateStock(productId: string, quantity: number): Promise<boolean> {
    const product = await this.findById(productId);
    if (!product) return false;

    product.stockQuantity += quantity;
    product.inStock = product.stockQuantity > 0;
    
    await this.update(productId, product);
    return true;
  }

  async findByPriceRange(minPrice: number, maxPrice: number): Promise<Product[]> {
    const products = await this.findAll();
    return products.filter(p => p.price >= minPrice && p.price <= maxPrice);
  }

  async getTopSelling(limit: number): Promise<Product[]> {
    // 실제로는 판매 데이터와 조인
    const products = await this.findAll();
    return products.slice(0, limit);
  }

  // Private methods
  private generateId(): string {
    return `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async invalidateCache(id?: string): Promise<void> {
    if (id) {
      await this.cache.delete(`${this.CACHE_PREFIX}${id}`);
    }
    // Clear list caches
    const pattern = `${this.CACHE_PREFIX}list:*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.deleteMany(keys);
    }
  }

  private seedData(): void {
    // 초기 데이터
    for (let i = 1; i <= 20; i++) {
      const product: Product = {
        id: `PROD-${i}`,
        name: `Product ${i}`,
        description: `Description for product ${i}`,
        price: Math.floor(Math.random() * 1000) / 10,
        category: ['electronics', 'clothing', 'food'][i % 3],
        inStock: Math.random() > 0.2,
        stockQuantity: Math.floor(Math.random() * 100),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.products.set(product.id, product);
    }
  }
}

/**
 * In-Memory Inventory Repository
 */
@Injectable()
export class InMemoryInventoryRepository implements IInventoryRepository {
  private inventory: Map<string, Inventory> = new Map();

  constructor() {
    this.seedData();
  }

  async getByProductId(productId: string): Promise<Inventory | null> {
    return this.inventory.get(productId) || null;
  }

  async getAll(): Promise<Inventory[]> {
    return Array.from(this.inventory.values());
  }

  async updateQuantity(productId: string, quantity: number): Promise<boolean> {
    const inv = this.inventory.get(productId);
    if (!inv) return false;

    inv.quantity += quantity;
    inv.available = inv.quantity - inv.reserved;
    this.inventory.set(productId, inv);
    
    return true;
  }

  async reserveStock(productId: string, quantity: number): Promise<boolean> {
    const inv = this.inventory.get(productId);
    if (!inv || inv.available < quantity) return false;

    inv.reserved += quantity;
    inv.available = inv.quantity - inv.reserved;
    this.inventory.set(productId, inv);
    
    return true;
  }

  async releaseReservation(productId: string, quantity: number): Promise<boolean> {
    const inv = this.inventory.get(productId);
    if (!inv) return false;

    inv.reserved = Math.max(0, inv.reserved - quantity);
    inv.available = inv.quantity - inv.reserved;
    this.inventory.set(productId, inv);
    
    return true;
  }

  async getLowStock(threshold: number): Promise<Inventory[]> {
    const all = await this.getAll();
    return all.filter(inv => inv.available < threshold);
  }

  private seedData(): void {
    for (let i = 1; i <= 20; i++) {
      const quantity = Math.floor(Math.random() * 1000);
      const reserved = Math.floor(quantity * 0.1);
      
      this.inventory.set(`PROD-${i}`, {
        productId: `PROD-${i}`,
        quantity,
        reserved,
        available: quantity - reserved,
        lastRestocked: new Date(),
        warehouse: 'main',
      });
    }
  }
}
