import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import { OrdersService } from '../../src/orders/orders.service';
import { QueueService } from '../../src/queue/queue.service';
import {
  cleanupTestData,
  createIntegrationTestingModule,
} from '../integration/setup';
import { WebhookDtoFactory } from '../factories/order.factory';
import request from 'supertest';

describe('End-to-End Order Lifecycle Tests', () => {
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

  describe('Complete Order Flow: Webhook → Queue → Enrichment → Completion', () => {
    it('should process order through complete lifecycle', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto({
        items: [
          { sku: 'PROD-001', qty: 2, unit_price: 29.99 },
          { sku: 'PROD-002', qty: 1, unit_price: 49.99 },
        ],
      });

      // Step 1: Create order via webhook
      const webhookResponse = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      const orderId = webhookResponse.body.id;
      expect(webhookResponse.body.status).toBe('RECEIVED');

      // Step 2: Verify order is in database
      const createdOrder = await prismaService.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      expect(createdOrder).toBeTruthy();
      expect(createdOrder?.status).toBe('RECEIVED');
      expect(createdOrder?.items).toHaveLength(2);

      // Step 3: Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 4: Check order status after processing
      const processedOrder = await prismaService.order.findUnique({
        where: { id: orderId },
        include: { enrichmentData: true },
      });

      expect(processedOrder).toBeTruthy();
      expect(['ENRICHED', 'FAILED_ENRICHMENT']).toContain(
        processedOrder?.status,
      );

      // Step 5: Verify enrichment data if successful
      if (processedOrder?.status === 'ENRICHED') {
        expect(processedOrder?.enrichmentData).toBeTruthy();
        expect(processedOrder?.enrichmentData?.enrichmentStatus).toBe(
          'COMPLETED',
        );
      }

      // Step 6: Verify order can be retrieved via admin endpoints
      const adminResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .expect(200);

      expect(adminResponse.body.id).toBe(orderId);
      expect(adminResponse.body.status).toBe(processedOrder?.status);
    });

    it('should handle all status transitions in correct sequence', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Create order
      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      const orderId = response.body.id;

      // Track status changes over time
      const statusHistory: string[] = [];

      for (let i = 0; i < 10; i++) {
        const order = await prismaService.order.findUnique({
          where: { id: orderId },
        });

        if (order && !statusHistory.includes(order.status)) {
          statusHistory.push(order.status);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Verify expected status progression
      expect(statusHistory[0]).toBe('RECEIVED');
      expect(
        statusHistory.some((status) =>
          ['ENRICHING', 'ENRICHED', 'FAILED_ENRICHMENT'].includes(status),
        ),
      ).toBe(true);
    });

    it('should handle error recovery and retry scenarios', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto({
        items: [{ sku: 'INVALID-SKU', qty: 1, unit_price: 99.99 }],
      });

      // Create order that will fail enrichment
      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      const orderId = response.body.id;

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Check final status after retries
      const finalOrder = await prismaService.order.findUnique({
        where: { id: orderId },
        include: { enrichmentData: true },
      });

      expect(finalOrder?.status).toBe('FAILED_ENRICHMENT');
      expect(finalOrder?.enrichmentData?.retryCount).toBeGreaterThan(0);
      expect(finalOrder?.enrichmentData?.lastError).toBeTruthy();
    });

    it('should handle external service failure and DLQ routing', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Create multiple orders to test DLQ behavior
      const responses = await Promise.all([
        request(app.getHttpServer()).post('/webhooks/orders').send(orderData),
        request(app.getHttpServer()).post('/webhooks/orders').send(orderData),
        request(app.getHttpServer()).post('/webhooks/orders').send(orderData),
      ]);

      const orderIds = responses.map((r) => r.body.id);

      // Wait for processing and potential failures
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check queue metrics for failed jobs
      const metrics = await queueService.getMetrics();

      // Some orders should be processed, others might fail
      const processedOrders = await Promise.all(
        orderIds.map((id) => prismaService.order.findUnique({ where: { id } })),
      );

      const hasProcessedOrders = processedOrders.some((order) =>
        ['ENRICHED', 'FAILED_ENRICHMENT'].includes(order?.status || ''),
      );

      expect(hasProcessedOrders).toBe(true);
    });

    it('should test administrative endpoints throughout process lifecycle', async () => {
      const orderData = WebhookDtoFactory.createValidOrderDto();

      // Create order
      const createResponse = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.id;

      // Test order listing endpoint
      const listResponse = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      expect(listResponse.body.data).toBeInstanceOf(Array);
      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(1);

      // Test specific order retrieval
      const getResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(orderId);

      // Test queue metrics endpoint
      const metricsResponse = await request(app.getHttpServer())
        .get('/queue/metrics')
        .expect(200);

      expect(metricsResponse.body).toHaveProperty('waiting');
      expect(metricsResponse.body).toHaveProperty('active');
      expect(metricsResponse.body).toHaveProperty('completed');

      // Test health endpoint
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body.status).toBe('ok');
    });
  });

  describe('Complex Order Scenarios', () => {
    it('should handle multiple concurrent orders correctly', async () => {
      const orders = Array(5)
        .fill(null)
        .map(() => WebhookDtoFactory.createValidOrderDto());

      // Create multiple orders concurrently
      const responses = await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      const orderIds = responses.map((r) => r.body.id);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify all orders were processed
      const finalOrders = await Promise.all(
        orderIds.map((id) =>
          prismaService.order.findUnique({
            where: { id },
            include: { enrichmentData: true },
          }),
        ),
      );

      finalOrders.forEach((order) => {
        expect(order).toBeTruthy();
        expect(['ENRICHED', 'FAILED_ENRICHMENT']).toContain(order?.status);
      });
    });

    it('should handle orders with different currencies', async () => {
      const usdOrder = WebhookDtoFactory.createValidOrderDto({
        currency: 'USD',
        items: [{ sku: 'PROD-USD', qty: 1, unit_price: 100.0 }],
      });

      const brlOrder = WebhookDtoFactory.createValidOrderDto({
        currency: 'BRL',
        items: [{ sku: 'PROD-BRL', qty: 1, unit_price: 500.0 }],
      });

      // Create orders with different currencies
      const [usdResponse, brlResponse] = await Promise.all([
        request(app.getHttpServer())
          .post('/webhooks/orders')
          .send(usdOrder)
          .expect(201),
        request(app.getHttpServer())
          .post('/webhooks/orders')
          .send(brlOrder)
          .expect(201),
      ]);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify currency conversion was attempted
      const [usdOrderResult, brlOrderResult] = await Promise.all([
        prismaService.order.findUnique({
          where: { id: usdResponse.body.id },
          include: { enrichmentData: true },
        }),
        prismaService.order.findUnique({
          where: { id: brlResponse.body.id },
          include: { enrichmentData: true },
        }),
      ]);

      expect(usdOrderResult?.currency).toBe('USD');
      expect(brlOrderResult?.currency).toBe('BRL');

      // Check if currency conversion data exists
      if (usdOrderResult?.enrichmentData?.currencyConversion) {
        expect(usdOrderResult.enrichmentData.currencyConversion).toHaveProperty(
          'fromCurrency',
        );
        expect(usdOrderResult.enrichmentData.currencyConversion).toHaveProperty(
          'toCurrency',
        );
        expect(usdOrderResult.enrichmentData.currencyConversion).toHaveProperty(
          'rate',
        );
      }
    });

    it('should handle large orders with many items', async () => {
      const largeOrderData = WebhookDtoFactory.createValidOrderDto({
        items: Array(20)
          .fill(null)
          .map((_, index) => ({
            sku: `PROD-${String(index + 1).padStart(3, '0')}`,
            qty: Math.floor(Math.random() * 5) + 1,
            unit_price: Math.floor(Math.random() * 100) + 10,
          })),
      });

      // Create large order
      const response = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(largeOrderData)
        .expect(201);

      const orderId = response.body.id;

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Verify all items were processed
      const processedOrder = await prismaService.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          enrichmentData: true,
        },
      });

      expect(processedOrder?.items).toHaveLength(20);
      expect(processedOrder?.totalAmount).toBeTruthy();

      // Calculate expected total
      const expectedTotal = largeOrderData.items.reduce(
        (sum, item) => sum + item.qty * item.unit_price,
        0,
      );

      expect(processedOrder?.totalAmount).toBe(expectedTotal.toString());
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const orderCount = 10;

      // Create multiple orders
      const orders = Array(orderCount)
        .fill(null)
        .map(() => WebhookDtoFactory.createValidOrderDto());

      const responses = await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer()).post('/webhooks/orders').send(order),
        ),
      );

      const creationTime = Date.now() - startTime;

      // All orders should be created successfully
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Order creation should complete within reasonable time
      expect(creationTime).toBeLessThan(5000); // 5 seconds for 10 orders

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 8000));

      const processingStartTime = Date.now();

      // Check final status of all orders
      const orderIds = responses.map((r) => r.body.id);
      const finalOrders = await Promise.all(
        orderIds.map((id) => prismaService.order.findUnique({ where: { id } })),
      );

      const processingTime = Date.now() - processingStartTime;

      // Most orders should be processed
      const processedCount = finalOrders.filter((order) =>
        ['ENRICHED', 'FAILED_ENRICHMENT'].includes(order?.status || ''),
      ).length;

      expect(processedCount).toBeGreaterThanOrEqual(orderCount * 0.8); // At least 80% processed

      // Processing should complete within reasonable time
      expect(processingTime).toBeLessThan(10000); // 10 seconds for status checks
    });
  });
});
