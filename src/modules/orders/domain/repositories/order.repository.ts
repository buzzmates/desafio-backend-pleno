import { Order } from '../entities/order';
import { OrderStatus } from '../enums/order-status-enum';

export abstract class IOrderRepository {
  abstract save(order: Order): Promise<Order>;
  abstract findByIdempotencyKey(key: string): Promise<Order | null>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findAll(status?: OrderStatus): Promise<Order[]>;
}
