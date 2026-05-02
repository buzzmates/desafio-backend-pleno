import { OrderStatus } from '../../domain/enums/order-status-enum';

export class ResponseDetailOrder {
  id!: string;
  order_id!: string;
  idempotency_key!: string;
  status!: OrderStatus;
  customer!: {
    name: string;
    email: string;
  };
  items!: {
    sku: string;
    qty: number;
    unit_price: number;
  }[];
  currency!: string;
  total_amount!: number;
  converted_amount!: number | null;
  created_at!: Date;
  updated_at!: Date;
}
