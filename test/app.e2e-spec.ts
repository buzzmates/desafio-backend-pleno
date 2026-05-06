import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { OrdersController } from '../src/modules/orders/presentation/controllers/orders.controller';
import { WebhookController } from '../src/modules/orders/presentation/controllers/webhooks.controller';
import { OrderService } from '../src/modules/orders/application/orders.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Orders HTTP Validation (e2e)', () => {
  let app: INestApplication<App>;
  let orderService: {
    receiveOrder: ReturnType<typeof jest.fn>;
    findAll: ReturnType<typeof jest.fn>;
    findById: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    orderService = {
      receiveOrder: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController, OrdersController],
      providers: [{ provide: OrderService, useValue: orderService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects invalid webhook payloads before they reach the service', async () => {
    return request(app.getHttpServer())
      .post('/webhooks/orders')
      .send({
        order_id: 'ext-123',
        customer: {
          name: 'Ana',
          email: 'invalid-email',
        },
        items: [{ sku: 'ABC123', qty: 0, unit_price: -1 }],
        currency: 'USD',
        idempotency_key: 'key-123',
      })
      .expect(400)
      .expect(() => {
        expect(orderService.receiveOrder).not.toHaveBeenCalled();
      });
  });

  it('rejects an invalid status filter before it reaches the service', () => {
    return request(app.getHttpServer())
      .get('/orders?status=INVALID')
      .expect(400)
      .expect(() => {
        expect(orderService.findAll).not.toHaveBeenCalled();
      });
  });
});
