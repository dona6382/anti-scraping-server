import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

/**
 * Product DTOs
 * 제품 관련 데이터 전송 객체
 */

export class GetProductsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'name' | 'date';
}

export class ProductSpecifications {
  weight: string;
  dimensions: string;
  material: string;
}

export class ProductResponseDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  inStock: boolean;
  specifications?: ProductSpecifications;
}

export class ProductListResponseDto {
  status: 'success' | 'error';
  page: number;
  limit: number;
  total: number;
  data: ProductResponseDto[];
}

export class PricingDataDto {
  productId: string;
  category: string;
  basePrice: number;
  discountPrice: number;
  currency: string;
  lastUpdated: Date;
}

export class InventoryDataDto {
  productId: string;
  quantity: number;
  reserved?: number;
  available: number;
  lastRestocked?: Date;
}

export class InventoryResponseDto {
  status: 'success' | 'error';
  count?: number;
  data: InventoryDataDto | InventoryDataDto[];
}
