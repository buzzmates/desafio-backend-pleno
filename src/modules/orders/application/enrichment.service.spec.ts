import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EnrichmentService } from './enrichment.service';
import { Order } from '../domain/entities/order';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { ExchangeRateService } from '../infrastructure/external/exchange-rate.service';

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let ordersRepo: jest.Mocked<IOrderRepository>;
  let exchangeRateService: jest.Mocked<Pick<ExchangeRateService, 'convert'>>;

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

  beforeEach(() => {
    ordersRepo = {
      save: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      createIfAbsent: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    exchangeRateService = {
      convert: jest.fn(),
    };

    service = new EnrichmentService(
      ordersRepo,
      exchangeRateService as unknown as ExchangeRateService,
    );
  });

  it('marks the order as ENRICHED and saves it when conversion succeeds', async () => {
    const order = makeOrder();

    ordersRepo.findById.mockResolvedValue(order);
    exchangeRateService.convert.mockResolvedValue(601.23);
    ordersRepo.save.mockResolvedValue(
      makeOrder({
        converted_amount: 601.23,
        status: OrderStatus.ENRICHED,
      }),
    );

    await service.enrich('order-1');

    expect(ordersRepo.findById).toHaveBeenCalledWith('order-1');
    expect(exchangeRateService.convert).toHaveBeenCalledWith(
      'USD',
      'BRL',
      119.8,
    );
    expect(order.converted_amount).toBe(601.23);
    expect(order.status).toBe(OrderStatus.ENRICHED);
    expect(ordersRepo.save).toHaveBeenCalledWith(order);
  });

  it('throws when enrich does not find the order', async () => {
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.enrich('missing')).rejects.toThrow(
      'Order not found: missing',
    );
    expect(exchangeRateService.convert).not.toHaveBeenCalled();
    expect(ordersRepo.save).not.toHaveBeenCalled();
  });

  it('marks the order as FAILED_ENRICHMENT and saves it', async () => {
    const order = makeOrder();

    ordersRepo.findById.mockResolvedValue(order);
    ordersRepo.save.mockResolvedValue(
      makeOrder({ status: OrderStatus.FAILED_ENRICHMENT }),
    );

    await service.markAsFailed('order-1');

    expect(ordersRepo.findById).toHaveBeenCalledWith('order-1');
    expect(order.status).toBe(OrderStatus.FAILED_ENRICHMENT);
    expect(ordersRepo.save).toHaveBeenCalledWith(order);
  });

  it('does nothing when markAsFailed does not find the order', async () => {
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.markAsFailed('missing')).resolves.toBeUndefined();
    expect(ordersRepo.save).not.toHaveBeenCalled();
  });
});
