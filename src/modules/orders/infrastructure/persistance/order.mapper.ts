import { Order } from '../../domain/entities/order';
import { OrderEntity } from './order.entity';

export class OrderMapper {
  static toDomain(entity: OrderEntity): Order {
    const order = new Order();
    order.id = entity.id;
    order.order_id = entity.order_id;
    order.idempotency_key = entity.idempotency_key;
    order.customer_name = entity.customer_name;
    order.customer_email = entity.customer_email;
    order.items = entity.items;
    order.currency = entity.currency;
    order.total_amount = Number(entity.total_amount);
    order.status = entity.status;
    order.created_at = entity.created_at;
    order.updated_at = entity.updated_at;
    return order;
  }

  static toPersistence(order: Order): Partial<OrderEntity> {
    return {
      ...(order.id && { id: order.id }),
      order_id: order.order_id,
      idempotency_key: order.idempotency_key,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      items: order.items,
      currency: order.currency,
      total_amount: order.total_amount,
      status: order.status,
    };
  }
}
