import { IPaginatedRepository } from './base.repository.interface';
import { OrderStatus } from '../../../modules/order/dto/order.dto';

/**
 * Order Entity
 */
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Order Item
 */
export interface OrderItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

/**
 * Order Repository Interface
 */
export interface IOrderRepository extends IPaginatedRepository<Order> {
  findByUserId(userId: string): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
  updateStatus(orderId: string, status: OrderStatus): Promise<boolean>;
  getTotalRevenue(startDate?: Date, endDate?: Date): Promise<number>;
  getOrderCount(userId?: string, status?: OrderStatus): Promise<number>;
  findPendingOrders(olderThan: Date): Promise<Order[]>;
}
