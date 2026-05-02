import { Order } from '../entities/order';
import { OrderStatus } from '../enums/order-status-enum';

export type CreateIfAbsentResult = {
  order: Order;
  created: boolean;
};

export abstract class IOrderRepository {
  abstract save(order: Order): Promise<Order>;
  abstract findByIdempotencyKey(key: string): Promise<Order | null>;
  abstract createIfAbsent(order: Order): Promise<CreateIfAbsentResult>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findAll(status?: OrderStatus): Promise<Order[]>;
}
