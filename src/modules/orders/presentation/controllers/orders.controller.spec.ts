import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { OrderService } from '../../application/orders.service';
import { OrderStatus } from '../../domain/enums/order-status-enum';
import { OrderNotFound } from '../../domain/errors/order-not-found.error';
import { OrdersController } from './orders.controller';
import { ResponseDetailOrder } from '../dtos/response-details-order.dto';
import { ResponseOrderDto } from '../dtos/response-order.dto';

describe('OrdersController', () => {
  let controller: OrdersController;
  let orderService: jest.Mocked<Pick<OrderService, 'findAll' | 'findById'>>;

  const detailResponse: ResponseDetailOrder = {
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
    converted_amount: 601.23,
    created_at: new Date('2026-05-03T10:00:00.000Z'),
    updated_at: new Date('2026-05-03T10:05:00.000Z'),
  };

  const listResponse: ResponseOrderDto[] = [
    {
      id: 'order-1',
      order_id: 'ext-123',
      status: OrderStatus.RECEIVED,
      idempotency_key: 'key-123',
      created_at: new Date('2026-05-03T10:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    orderService = {
      findAll: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<Pick<OrderService, 'findAll' | 'findById'>>;

    controller = new OrdersController(orderService as unknown as OrderService);
  });

  it('returns the order list using the provided status filter', async () => {
    orderService.findAll.mockResolvedValue(listResponse);

    await expect(controller.findAll(OrderStatus.RECEIVED)).resolves.toEqual(
      listResponse,
    );
    expect(orderService.findAll).toHaveBeenCalledWith(OrderStatus.RECEIVED);
  });

  it('returns the order detail by id', async () => {
    orderService.findById.mockResolvedValue(detailResponse);

    await expect(controller.findById('order-1')).resolves.toEqual(
      detailResponse,
    );
    expect(orderService.findById).toHaveBeenCalledWith('order-1');
  });

  it('translates OrderNotFound into NotFoundException', async () => {
    orderService.findById.mockRejectedValue(new OrderNotFound());

    await expect(controller.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rethrows unexpected findById errors', async () => {
    orderService.findById.mockRejectedValue(new Error('unexpected'));

    await expect(controller.findById('order-1')).rejects.toThrow('unexpected');
  });
});
