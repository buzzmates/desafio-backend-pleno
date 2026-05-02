import { OrderStatus } from '../enums/order-status-enum';
import { CreateOrderCommand, OrderItem } from '../types/order.type';

export class Order {
  id!: string;
  order_id!: string;
  idempotency_key!: string;
  customer_name!: string;
  customer_email!: string;
  items!: OrderItem[];
  currency!: string;
  total_amount!: number;
  converted_amount!: number;
  status!: OrderStatus;
  created_at!: Date;
  updated_at!: Date;

  static create(data: CreateOrderCommand): Order {
    const order = new Order();
    order.order_id = data.order_id;
    order.idempotency_key = data.idempotency_key;
    order.customer_name = data.customer_name;
    order.customer_email = data.customer_email;
    order.items = data.items;
    order.currency = data.currency;
    order.total_amount = data.items.reduce(
      (total, item) => total + item.qty * item.unit_price,
      0,
    );
    order.status = OrderStatus.RECEIVED;
    return order;
  }
}
