import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OrderService } from './orders.service';
import { Order } from '../domain/entities/order';
import { IOrderQueue } from '../domain/queues/order.queue';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { OrderNotFound } from '../domain/errors/order-not-found.error';
import { CreateOrderCommand } from '../domain/types/order.type';

describe('OrderService', () => {
  let service: OrderService;
  let ordersRepo: jest.Mocked<IOrderRepository>;
  let queueRepo: jest.Mocked<IOrderQueue>;

  const command: CreateOrderCommand = {
    order_id: 'ext-123',
    idempotency_key: 'key-123',
    customer_name: 'Ana',
    customer_email: 'user@example.com',
    items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
  };

  const makeOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'order-1',
    order_id: 'ext-123',
    idempotency_key: 'key-123',
    customer_name: 'Ana',
    customer_email: 'user@example.com',
    items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    total_amount: 119.8,
    converted_amount: 650.12,
    status: OrderStatus.RECEIVED,
    created_at: new Date('2026-05-03T10:00:00.000Z'),
    updated_at: new Date('2026-05-03T10:05:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    ordersRepo = {
      save: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      createIfAbsent: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    queueRepo = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<IOrderQueue>;

    service = new OrderService(ordersRepo, queueRepo);
  });

  it('enqueues when a new order is created', async () => {
    const order = makeOrder();

    ordersRepo.createIfAbsent.mockResolvedValue({
      order,
      created: true,
    });

    const result = await service.receiveOrder(command);

    expect(ordersRepo.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: 'ext-123',
        idempotency_key: 'key-123',
        customer_name: 'Ana',
        customer_email: 'user@example.com',
        currency: 'USD',
        total_amount: 119.8,
        status: OrderStatus.RECEIVED,
      }),
    );
    expect(queueRepo.enqueue).toHaveBeenCalledWith({ order_id: 'order-1' });
    expect(result).toEqual({
      id: 'order-1',
      order_id: 'ext-123',
      status: OrderStatus.RECEIVED,
      idempotency_key: 'key-123',
      created_at: new Date('2026-05-03T10:00:00.000Z'),
    });
  });

  it('does not enqueue when the order already exists', async () => {
    const order = makeOrder();

    ordersRepo.createIfAbsent.mockResolvedValue({
      order,
      created: false,
    });

    const result = await service.receiveOrder(command);

    expect(queueRepo.enqueue).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'order-1',
      order_id: 'ext-123',
      status: OrderStatus.RECEIVED,
      idempotency_key: 'key-123',
      created_at: new Date('2026-05-03T10:00:00.000Z'),
    });
  });

  it('propagates queue errors during receiveOrder', async () => {
    const order = makeOrder();

    ordersRepo.createIfAbsent.mockResolvedValue({
      order,
      created: true,
    });
    queueRepo.enqueue.mockRejectedValue(new Error('queue unavailable'));

    await expect(service.receiveOrder(command)).rejects.toThrow(
      'queue unavailable',
    );
  });

  it('returns detail when finding an order by id', async () => {
    const order = makeOrder({ status: OrderStatus.ENRICHED });

    ordersRepo.findById.mockResolvedValue(order);

    await expect(service.findById('order-1')).resolves.toEqual({
      id: 'order-1',
      order_id: 'ext-123',
      idempotency_key: 'key-123',
      status: OrderStatus.ENRICHED,
      customer: {
        name: 'Ana',
        email: 'user@example.com',
      },
      items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
      currency: 'USD',
      total_amount: 119.8,
      converted_amount: 650.12,
      created_at: new Date('2026-05-03T10:00:00.000Z'),
      updated_at: new Date('2026-05-03T10:05:00.000Z'),
    });
  });

  it('throws OrderNotFound when findById does not find the order', async () => {
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      OrderNotFound,
    );
  });

  it('maps findAll results to the summary dto', async () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: 'order-2',
        order_id: 'ext-456',
        idempotency_key: 'key-456',
        status: OrderStatus.ENRICHED,
      }),
    ];

    ordersRepo.findAll.mockResolvedValue(orders);

    await expect(service.findAll(OrderStatus.ENRICHED)).resolves.toEqual([
      {
        id: 'order-1',
        order_id: 'ext-123',
        status: OrderStatus.RECEIVED,
        idempotency_key: 'key-123',
        created_at: new Date('2026-05-03T10:00:00.000Z'),
      },
      {
        id: 'order-2',
        order_id: 'ext-456',
        status: OrderStatus.ENRICHED,
        idempotency_key: 'key-456',
        created_at: new Date('2026-05-03T10:00:00.000Z'),
      },
    ]);
    expect(ordersRepo.findAll).toHaveBeenCalledWith(OrderStatus.ENRICHED);
  });
});
