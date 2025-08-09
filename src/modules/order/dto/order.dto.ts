import { 
  IsString, 
  IsNumber, 
  IsArray, 
  IsOptional, 
  IsEnum, 
  Min, 
  ValidateNested,
  IsUUID,
  ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Order DTOs
 * 주문 관련 데이터 전송 객체
 */

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OrderResponseDto {
  orderId: string;
  userId: string;
  items: OrderItemDto[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export class OrderListResponseDto {
  status: 'success' | 'error';
  count: number;
  data: OrderResponseDto[];
}

export class OrderFilterDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
