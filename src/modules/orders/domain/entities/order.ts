import { OrderStatus } from '../enums/order-status-enum';
import { OrderItem } from '../types/order.type';

export class Order {
  id!: string;
  order_id!: string;
  idempotency_key!: string;
  customer_name!: string;
  customer_email!: string;
  items!: OrderItem[];
  currency!: string;
  total_amount!: number;
  status!: OrderStatus;
  created_at!: Date;
  updated_at!: Date;
}
