import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryFailedError, Repository } from 'typeorm';
import { Order } from '../../domain/entities/order';
import { OrderStatus } from '../../domain/enums/order-status-enum';
import { OrderEntity } from './order.entity';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('TypeOrmOrderRepository', () => {
  let repository: TypeOrmOrderRepository;
  let repo: jest.Mocked<
    Pick<
      Repository<OrderEntity>,
      'create' | 'save' | 'findOne' | 'find' | 'insert'
    >
  >;

  const makeOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'order-1',
    order_id: 'ext-123',
    idempotency_key: 'key-123',
    customer_name: 'Ana',
    customer_email: 'user@example.com',
    items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    total_amount: 119.8,
    converted_amount: null,
    status: OrderStatus.RECEIVED,
    created_at: new Date('2026-05-03T10:00:00.000Z'),
    updated_at: new Date('2026-05-03T10:05:00.000Z'),
    ...overrides,
  });

  const makeEntity = (overrides: Partial<OrderEntity> = {}): OrderEntity => ({
    id: 'order-1',
    order_id: 'ext-123',
    idempotency_key: 'key-123',
    customer_name: 'Ana',
    customer_email: 'user@example.com',
    items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    total_amount: 119.8,
    converted_amount: null,
    status: OrderStatus.RECEIVED,
    created_at: new Date('2026-05-03T10:00:00.000Z'),
    updated_at: new Date('2026-05-03T10:05:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      insert: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        Repository<OrderEntity>,
        'create' | 'save' | 'findOne' | 'find' | 'insert'
      >
    >;

    repository = new TypeOrmOrderRepository(
      repo as unknown as Repository<OrderEntity>,
    );
  });

  it('saves and maps a domain order', async () => {
    const order = makeOrder({
      status: OrderStatus.ENRICHED,
      converted_amount: 601.23,
    });
    const entity = makeEntity({
      status: OrderStatus.ENRICHED,
      converted_amount: 601.23,
    });

    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(repository.save(order)).resolves.toEqual(
      expect.objectContaining({
        id: 'order-1',
        status: OrderStatus.ENRICHED,
        converted_amount: 601.23,
        total_amount: 119.8,
      }),
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'order-1',
        order_id: 'ext-123',
        idempotency_key: 'key-123',
        currency: 'USD',
      }),
    );
  });

  it('returns the existing order on unique violation during save', async () => {
    const order = makeOrder();
    const entity = makeEntity();
    const uniqueViolation = new QueryFailedError('INSERT', [], {
      code: '23505',
    } as never);

    repo.create.mockReturnValue(entity);
    repo.save.mockRejectedValue(uniqueViolation);
    repo.findOne.mockResolvedValue(entity);

    const result = await repository.save(order);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { idempotency_key: 'key-123' },
    });
    expect(result).toEqual(expect.objectContaining({ id: 'order-1' }));
  });

  it('creates an order when createIfAbsent inserts successfully', async () => {
    const order = makeOrder();
    const entity = makeEntity();

    repo.create.mockReturnValue(entity);
    repo.insert.mockResolvedValue({
      identifiers: [{ id: 'order-1' }],
    } as never);
    repo.findOne.mockResolvedValue(entity);

    await expect(repository.createIfAbsent(order)).resolves.toEqual({
      order: expect.objectContaining({ id: 'order-1' }),
      created: true,
    });

    expect(repo.insert).toHaveBeenCalledWith(entity);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('returns the existing order when createIfAbsent hits unique violation', async () => {
    const order = makeOrder();
    const entity = makeEntity();
    const uniqueViolation = new QueryFailedError('INSERT', [], {
      code: '23505',
    } as never);

    repo.create.mockReturnValue(entity);
    repo.insert.mockRejectedValue(uniqueViolation);
    repo.findOne.mockResolvedValue(entity);

    await expect(repository.createIfAbsent(order)).resolves.toEqual({
      order: expect.objectContaining({ id: 'order-1' }),
      created: false,
    });

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { idempotency_key: 'key-123' },
    });
  });

  it('applies the status filter when listing orders', async () => {
    repo.find.mockResolvedValue([makeEntity({ status: OrderStatus.ENRICHED })]);

    const result = await repository.findAll(OrderStatus.ENRICHED);

    expect(repo.find).toHaveBeenCalledWith({
      where: { status: OrderStatus.ENRICHED },
    });
    expect(result).toEqual([
      expect.objectContaining({ status: OrderStatus.ENRICHED }),
    ]);
  });
});
