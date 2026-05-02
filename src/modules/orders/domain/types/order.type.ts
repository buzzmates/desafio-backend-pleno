export type OrderItem = {
  sku: string;
  qty: number;
  unit_price: number;
};

export type CreateOrderCommand = {
  order_id: string;
  idempotency_key: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
  currency: string;
};
