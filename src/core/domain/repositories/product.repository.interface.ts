import { IPaginatedRepository } from './base.repository.interface';

/**
 * Product Entity
 */
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  inStock: boolean;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product Repository Interface
 */
export interface IProductRepository extends IPaginatedRepository<Product> {
  findByCategory(category: string): Promise<Product[]>;
  findInStock(): Promise<Product[]>;
  updateStock(productId: string, quantity: number): Promise<boolean>;
  findByPriceRange(minPrice: number, maxPrice: number): Promise<Product[]>;
  getTopSelling(limit: number): Promise<Product[]>;
}

/**
 * Inventory Entity
 */
export interface Inventory {
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  lastRestocked?: Date;
  warehouse?: string;
}

/**
 * Inventory Repository Interface
 */
export interface IInventoryRepository {
  getByProductId(productId: string): Promise<Inventory | null>;
  getAll(): Promise<Inventory[]>;
  updateQuantity(productId: string, quantity: number): Promise<boolean>;
  reserveStock(productId: string, quantity: number): Promise<boolean>;
  releaseReservation(productId: string, quantity: number): Promise<boolean>;
  getLowStock(threshold: number): Promise<Inventory[]>;
}
