export type OrderItem = {
  sku: string;
  qty: number;
  unit_price: number;
};

export type PgDriverError = {
  code?: string;
};
