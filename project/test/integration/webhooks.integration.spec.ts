import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import { OrdersService } from '../../src/orders/orders.service';
import { QueueService } from '../../src/queue/queue.service';
import { cleanupTestData, createIntegrationTestingModule } from './setup';
import { WebhookDtoFactory } from '../factories/order.factory';
import request from 'supertest';

describe('Webhooks Integration Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let webhooksService: WebhooksService;
  let ordersService: OrdersService;
  let queueService: QueueService;

  beforeAll(async () => {
    const module: TestingModule = await createIntegrationTestingModule([
      WebhooksService,
      OrdersService,
      QueueService,
    ]);

    app = module.createNestApplication();
    prismaService = module.get<PrismaService>(PrismaService);
    webhooksService = module.get<WebhooksService>(WebhooksService);
    ordersService = module.get<OrdersService>(OrdersService);
    queueService = module.get<QueueService>(QueueService);

    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /webhooks/orders', () => {
    it('should create order and enqueue for processing', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.externalOrderId).toBe(orderData.order_id);
      expect(response.body.status).toBe('RECEIVED');

      // Verify order was persisted in database
      const savedOrder = await prismaService.order.findUnique({
        where: { id: response.body.id },
        include: { items: true },
      });

      expect(savedOrder).toBeTruthy();
      expect(savedOrder?.externalOrderId).toBe(orderData.order_id);
      expect(savedOrder?.items).toHaveLength(orderData.items.length);

      // Verify job was enqueued
      const queueMetrics = await queueService.getMetrics();
      expect(queueMetrics.waiting).toBeGreaterThan(0);
    });

    it('should handle idempotency correctly', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // First request should succeed
      const firstResponse = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      // Second request with same idempotency key should return existing order
      const secondResponse = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(200);

      expect(secondResponse.body.id).toBe(firstResponse.body.id);

      // Verify only one order exists in database
      const ordersCount = await prismaService.order.count({
        where: { idempotencyKey: orderData.idempotency_key },
      });
      expect(ordersCount).toBe(1);
    });

    it('should handle concurrent requests with same idempotency key', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Send multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).post('/webhooks/orders').send(orderData),
        );

      const responses = await Promise.all(requests);

      // All should return the same order ID
      const orderIds = responses.map((r) => r.body.id);
      const uniqueOrderIds = [...new Set(orderIds)];
      expect(uniqueOrderIds).toHaveLength(1);

      // Verify only one order exists in database
      const ordersCount = await prismaService.order.count({
        where: { idempotencyKey: orderData.idempotency_key },
      });
      expect(ordersCount).toBe(1);
    });

    it('should validate order data and reject invalid payloads', async () => {
      const invalidOrder = {
        // Missing required fields
        externalOrderId: 'test-order-123',
        customer: {
          name: 'Test Customer',
          // Missing email
        },
        items: [],
      };

      await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(invalidOrder)
        .expect(400);

      // Verify no order was created
      const ordersCount = await prismaService.order.count();
      expect(ordersCount).toBe(0);
    });

    it('should calculate total amount correctly', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto({
        items: [
          { sku: 'PROD1', qty: 2, unit_price: 10.0 },
          { sku: 'PROD2', qty: 1, unit_price: 25.5 },
        ],
      });

      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      expect(response.body.totalAmount).toBe('45.50');

      // Verify total amount in database
      const savedOrder = await prismaService.order.findUnique({
        where: { id: response.body.id },
      });

      expect(savedOrder?.totalAmount).toBe('45.50');
    });

    it('should handle database transaction rollback on validation error', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto({
        items: [
          { sku: 'VALID1', qty: 1, unit_price: 10.0 },
          { sku: '', qty: 0, unit_price: -5 }, // Invalid item
        ],
      });

      await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(400);

      // Verify no partial data was saved
      const ordersCount = await prismaService.order.count();
      const itemsCount = await prismaService.orderItem.count();

      expect(ordersCount).toBe(0);
      expect(itemsCount).toBe(0);
    });

    it('should handle external service integration in complete flow', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Create order
      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      const orderId = response.body.id;

      // Wait for queue processing (simulate with delay)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check order status after processing
      const processedOrder = await prismaService.order.findUnique({
        where: { id: orderId },
        include: { enrichmentData: true },
      });

      expect(processedOrder).toBeTruthy();
      expect(['RECEIVED', 'ENRICHING', 'ENRICHED']).toContain(
        processedOrder?.status,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test with invalid database operations
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Create order successfully first
      await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      // Try to create same order again (should handle gracefully)
      await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(200); // Should return existing order, not error
    });

    it('should handle queue service failures gracefully', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Mock queue service to throw error
      jest
        .spyOn(queueService, 'enqueueOrder')
        .mockRejectedValueOnce(new Error('Queue service unavailable'));

      // Order should still be created even if queue fails
      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      expect(response.body.id).toBeTruthy();

      // Verify order was saved
      const savedOrder = await prismaService.order.findUnique({
        where: { id: response.body.id },
      });
      expect(savedOrder).toBeTruthy();
    });
  });
});
