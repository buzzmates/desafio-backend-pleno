import { OrderStatus } from '../../domain/enums/order-status-enum';

export class ResponseOrderDto {
  id!: string;
  order_id!: string;
  status!: OrderStatus;
  idempotency_key!: string;
  created_at!: Date;
}
