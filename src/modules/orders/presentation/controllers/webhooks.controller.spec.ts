import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { OrderService } from '../../application/orders.service';
import { OrderAlreadyExistsError } from '../../domain/errors/order-already-existis.error';
import { WebhookController } from './webhooks.controller';
import { CreateOrderWebhookDto } from '../dtos/create-order.dto';
import { ResponseOrderDto } from '../dtos/response-order.dto';
import { OrderStatus } from '../../domain/enums/order-status-enum';

describe('WebhookController', () => {
  let controller: WebhookController;
  let orderService: jest.Mocked<Pick<OrderService, 'receiveOrder'>>;

  const body: CreateOrderWebhookDto = {
    order_id: 'ext-123',
    customer: {
      name: 'Ana',
      email: 'user@example.com',
    },
    items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    idempotency_key: 'key-123',
  };

  const response: ResponseOrderDto = {
    id: 'order-1',
    order_id: 'ext-123',
    status: OrderStatus.RECEIVED,
    idempotency_key: 'key-123',
    created_at: new Date('2026-05-03T10:00:00.000Z'),
  };

  beforeEach(() => {
    orderService = {
      receiveOrder: jest.fn(),
    } as unknown as jest.Mocked<Pick<OrderService, 'receiveOrder'>>;

    controller = new WebhookController(orderService as unknown as OrderService);
  });

  it('maps the webhook body into the command expected by the service', async () => {
    orderService.receiveOrder.mockResolvedValue(response);

    await expect(controller.receiveOrder(body)).resolves.toEqual(response);

    expect(orderService.receiveOrder).toHaveBeenCalledWith({
      order_id: 'ext-123',
      idempotency_key: 'key-123',
      customer_name: 'Ana',
      customer_email: 'user@example.com',
      items: [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
      currency: 'USD',
    });
  });

  it('translates OrderAlreadyExistsError into ConflictException', async () => {
    orderService.receiveOrder.mockRejectedValue(new OrderAlreadyExistsError());

    await expect(controller.receiveOrder(body)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows unexpected receiveOrder errors', async () => {
    orderService.receiveOrder.mockRejectedValue(new Error('unexpected'));

    await expect(controller.receiveOrder(body)).rejects.toThrow('unexpected');
  });
});
