import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import { QueueService } from '../../src/queue/queue.service';
import {
  cleanupTestData,
  createIntegrationTestingModule,
} from '../integration/setup';
import { WebhookDtoFactory } from '../factories/order.factory';
import request from 'supertest';

describe('Performance and Load Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let webhooksService: WebhooksService;
  let queueService: QueueService;

  beforeAll(async () => {
    const module: TestingModule = await createIntegrationTestingModule([
      WebhooksService,
      QueueService,
    ]);

    app = module.createNestApplication();
    prismaService = module.get<PrismaService>(PrismaService);
    webhooksService = module.get<WebhooksService>(WebhooksService);
    queueService = module.get<QueueService>(QueueService);

    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Order Creation Performance', () => {
    it('should handle concurrent order creation under load', async () => {
      const concurrency = 20;
      const ordersPerSecond = 10; // Target: 10 orders/second

      const startTime = Date.now();

      // Create orders concurrently
      const orders = Array(concurrency)
        .fill(null)
        .map(() =>
          WebhookDtoFactory.createValidOrderDto({
            items: [{ sku: 'PROD-PERF', qty: 1, unit_price: 29.99 }],
          }),
        );

      const promises = orders.map((order) =>
        request(app.getHttpServer()).post('/webhooks/orders').send(order),
      );

      const responses = await Promise.all(promises);
      const creationTime = Date.now() - startTime;

      // Verify all orders were created successfully
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });

      // Performance assertions
      expect(creationTime).toBeLessThan(3000); // 3 seconds for 20 orders
      expect(creationTime).toBeLessThan((concurrency / ordersPerSecond) * 1000); // Based on target rate

      // Verify database consistency
      const orderIds = responses.map((r) => r.body.id);
      const savedOrders = await Promise.all(
        orderIds.map((id) => prismaService.order.findUnique({ where: { id } })),
      );

      expect(savedOrders.filter((order) => order !== null)).toHaveLength(
        concurrency,
      );
    });

    it('should maintain performance with varying order sizes', async () => {
      const orderSizes = [
        { name: 'small', items: 1 },
        { name: 'medium', items: 5 },
        { name: 'large', items: 20 },
      ];

      const results = await Promise.all(
        orderSizes.map(async ({ name, items }) => {
          const startTime = Date.now();

          const orderData = WebhookDtoFactory.createValidOrderDto({
            items: Array(items)
              .fill(null)
              .map((_, index) => ({
                sku: `PROD-${name}-${index + 1}`,
                qty: 1,
                unit_price: 29.99,
              })),
          });

          await request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(orderData)
            .expect(201);

          return {
            size: name,
            itemCount: items,
            time: Date.now() - startTime,
          };
        }),
      );

      // Performance should scale reasonably with order size
      results.forEach((result) => {
        expect(result.time).toBeLessThan(1000); // 1 second max per order
      });

      // Large orders shouldn't be disproportionately slower
      const smallOrderTime = results.find((r) => r.size === 'small')?.time || 0;
      const largeOrderTime = results.find((r) => r.size === 'large')?.time || 0;

      // Large order should not take more than 5x time of small order
      expect(largeOrderTime).toBeLessThan(smallOrderTime * 5);
    });
  });

  describe('Queue Processing Performance', () => {
    it('should process queue jobs efficiently under load', async () => {
      const jobCount = 50;

      // Create orders to generate queue jobs
      const orders = Array(jobCount)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: [
              { sku: `PROD-QUEUE-${index + 1}`, qty: 1, unit_price: 19.99 },
            ],
          }),
        );

      // Create orders and enqueue jobs
      const startTime = Date.now();
      await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      const enqueueTime = Date.now() - startTime;

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check queue metrics
      const metrics = await queueService.getMetrics();

      // Performance assertions
      expect(enqueueTime).toBeLessThan(5000); // 5 seconds for 50 jobs
      expect(
        metrics.waiting + metrics.active + metrics.completed,
      ).toBeGreaterThanOrEqual(jobCount);

      // Most jobs should be processed or actively processing
      const processedOrActive = metrics.completed + metrics.active;
      expect(processedOrActive).toBeGreaterThan(jobCount * 0.7); // At least 70% processed
    });

    it('should handle queue throughput under sustained load', async () => {
      const batchSize = 20;
      const batchCount = 3;
      const targetThroughput = 5; // 5 jobs per second

      const throughputResults = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const startTime = Date.now();

        // Create batch of orders
        const orders = Array(batchSize)
          .fill(null)
          .map((_, index) =>
            WebhookDtoFactory.createValidOrderDto({
              items: [
                {
                  sku: `PROD-THRUPUT-${batch}-${index + 1}`,
                  qty: 1,
                  unit_price: 9.99,
                },
              ],
            }),
          );

        await Promise.all(
          orders.map((order) =>
            request(app.getHttpServer())
              .post('/webhooks/orders')
              .send(order)
              .expect(201),
          ),
        );

        const enqueueTime = Date.now() - startTime;
        const throughput = (batchSize / enqueueTime) * 1000; // jobs per second

        throughputResults.push({
          batch: batch + 1,
          throughput,
          time: enqueueTime,
        });

        // Brief pause between batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Calculate average throughput
      const avgThroughput =
        throughputResults.reduce((sum, r) => sum + r.throughput, 0) /
        throughputResults.length;

      // Performance assertions
      expect(avgThroughput).toBeGreaterThan(targetThroughput * 0.6); // At least 60% of target
      throughputResults.forEach((result) => {
        expect(result.throughput).toBeGreaterThan(targetThroughput * 0.4); // Each batch at least 40% of target
      });
    });
  });

  describe('Database Performance', () => {
    it('should maintain query performance with large datasets', async () => {
      const datasetSize = 100;

      // Create large dataset
      const orders = Array(datasetSize)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: Array(3)
              .fill(null)
              .map((_, itemIndex) => ({
                sku: `PROD-DATA-${index}-${itemIndex + 1}`,
                qty: Math.floor(Math.random() * 5) + 1,
                unit_price: Math.floor(Math.random() * 100) + 10,
              })),
          }),
        );

      // Insert all orders
      await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      // Test query performance
      const queryStartTime = Date.now();

      // Test order listing performance
      const listResponse = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      const listQueryTime = Date.now() - queryStartTime;

      // Test individual order retrieval
      const individualStartTime = Date.now();

      const individualResponses = await Promise.all(
        Array(10)
          .fill(null)
          .map(async (_, index) => {
            const orderId = listResponse.body.data[index]?.id;
            if (orderId) {
              return await request(app.getHttpServer())
                .get(`/orders/${orderId}`)
                .expect(200);
            }
            return null;
          }),
      );

      const individualQueryTime = Date.now() - individualStartTime;

      // Performance assertions
      expect(listQueryTime).toBeLessThan(1000); // 1 second for list query
      expect(individualQueryTime).toBeLessThan(2000); // 2 seconds for 10 individual queries
      expect(listResponse.body.data).toHaveLength(datasetSize);
    });

    it('should handle pagination efficiently', async () => {
      const totalOrders = 200;

      // Create large dataset
      const orders = Array(totalOrders)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: [
              { sku: `PROD-PAGE-${index + 1}`, qty: 1, unit_price: 19.99 },
            ],
          }),
        );

      await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      // Test pagination performance
      const pageSizes = [10, 25, 50, 100];
      const paginationResults = [];

      for (const pageSize of pageSizes) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/orders?limit=${pageSize}&page=1`)
          .expect(200);

        const queryTime = Date.now() - startTime;

        paginationResults.push({
          pageSize,
          queryTime,
          returnedCount: response.body.data.length,
        });

        expect(response.body.data.length).toBeLessThanOrEqual(pageSize);
        expect(queryTime).toBeLessThan(500); // 500ms max per pagination query
      }

      // Verify pagination consistency
      const totalItems = paginationResults.reduce(
        (sum, r) => sum + r.returnedCount,
        0,
      );
      expect(totalItems).toBeGreaterThanOrEqual(totalOrders * 0.9); // Account for any processing delays
    });
  });

  describe('External Service Timeout Performance', () => {
    it('should handle external service timeouts gracefully', async () => {
      const timeoutTestOrders = 10;

      // Create orders that will test external service timeouts
      const orders = Array(timeoutTestOrders)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: [
              {
                sku: `PROD-TIMEOUT-${index + 1}`,
                qty: 1,
                unit_price: 29.99,
              },
            ],
          }),
        );

      // Create orders
      const startTime = Date.now();
      await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      // Wait for external service interactions and potential timeouts
      await new Promise((resolve) => setTimeout(resolve, 15000));

      const processingTime = Date.now() - startTime;

      // Check final order states
      const orderIds = orders.map((_, index) => index + 1); // Simplified ID tracking
      const finalOrders = await Promise.all(
        orderIds.map((id) =>
          prismaService.order.findUnique({
            where: { id: id.toString() },
            include: { enrichmentData: true },
          }),
        ),
      );

      const successfulOrders = finalOrders.filter(
        (order) => order?.status === 'ENRICHED',
      ).length;

      const failedOrders = finalOrders.filter(
        (order) => order?.status === 'FAILED_ENRICHMENT',
      ).length;

      // Performance and resilience assertions
      expect(processingTime).toBeLessThan(20000); // 20 seconds max for timeout handling
      expect(successfulOrders + failedOrders).toBe(timeoutTestOrders); // All orders should be processed

      // Some orders may fail due to timeouts, but system should remain responsive
      expect(failedOrders).toBeLessThan(timeoutTestOrders * 0.8); // Not all should fail
    });

    it('should maintain performance during external service degradation', async () => {
      const degradationOrders = 30;

      // Create orders during simulated external service issues
      const orders = Array(degradationOrders)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: [
              {
                sku: `PROD-DEGRADE-${index + 1}`,
                qty: 1,
                unit_price: 39.99,
              },
            ],
          }),
        );

      // Measure creation performance under degradation
      const creationStartTime = Date.now();
      await Promise.all(
        orders.map((order) =>
          request(app.getHttpServer())
            .post('/webhooks/orders')
            .send(order)
            .expect(201),
        ),
      );

      const creationTime = Date.now() - creationStartTime;

      // Wait for processing with potential external service issues
      await new Promise((resolve) => setTimeout(resolve, 12000));

      const totalProcessingTime = Date.now() - creationStartTime;

      // Check queue metrics during degradation
      const metrics = await queueService.getMetrics();

      // Performance assertions during degradation
      expect(creationTime).toBeLessThan(8000); // 8 seconds for 30 orders
      expect(totalProcessingTime).toBeLessThan(25000); // 25 seconds total

      // System should continue processing even with external issues
      expect(
        metrics.waiting + metrics.active + metrics.completed,
      ).toBeGreaterThan(degradationOrders * 0.5);
    });
  });

  describe('Performance Benchmarks Validation', () => {
    it('should meet target performance benchmarks', async () => {
      const benchmarkOrders = 25;

      // Comprehensive performance test
      const startTime = Date.now();

      const orders = Array(benchmarkOrders)
        .fill(null)
        .map((_, index) =>
          WebhookDtoFactory.createValidOrderDto({
            items: [
              { sku: `PROD-BENCH-${index + 1}-A`, qty: 1, unit_price: 19.99 },
              { sku: `PROD-BENCH-${index + 1}-B`, qty: 2, unit_price: 9.99 },
            ],
          }),
        );

      // Create orders
      const creationPromises = orders.map((order) =>
        request(app.getHttpServer()).post('/webhooks/orders').send(order),
      );

      const creationResults = await Promise.all(creationPromises);
      const creationTime = Date.now() - startTime;

      // Wait for initial processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const processingStartTime = Date.now();

      // Check queue status
      const queueMetrics = await queueService.getMetrics();

      // Test admin endpoints performance
      const adminStartTime = Date.now();

      await Promise.all([
        request(app.getHttpServer()).get('/orders').expect(200),
        request(app.getHttpServer()).get('/queue/metrics').expect(200),
        request(app.getHttpServer()).get('/health').expect(200),
      ]);

      const adminTime = Date.now() - adminStartTime;
      const totalTestTime = Date.now() - startTime;

      // Benchmark assertions
      expect(creationTime).toBeLessThan(3000); // 3 seconds for 25 orders
      expect(adminTime).toBeLessThan(1000); // 1 second for admin endpoints
      expect(totalTestTime).toBeLessThan(10000); // 10 seconds total test time

      // Verify all orders created successfully
      const successfulCreations = creationResults.filter(
        (r) => r.status === 201,
      ).length;
      expect(successfulCreations).toBe(benchmarkOrders);

      // Queue should be processing jobs
      expect(queueMetrics.waiting + queueMetrics.active).toBeGreaterThan(0);

      console.log(`Performance Benchmark Results:
        - Order Creation: ${creationTime}ms (${((benchmarkOrders / creationTime) * 1000).toFixed(2)} orders/sec)
        - Admin Endpoints: ${adminTime}ms
        - Queue Processing: ${queueMetrics.waiting} waiting, ${queueMetrics.active} active
        - Total Test Time: ${totalTestTime}ms`);
    });
  });
});
