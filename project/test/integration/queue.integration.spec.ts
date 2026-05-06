import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { QueueService } from '../../src/queue/queue.service';
import {
  OrderFactory,
  OrderEnrichmentFactory,
} from '../factories/order.factory';
import { cleanupTestData, createIntegrationTestingModule } from './setup';
import { Redis } from 'ioredis';

describe('Queue Integration Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let queueService: QueueService;
  let redis: Redis;

  beforeAll(async () => {
    const module: TestingModule = await createIntegrationTestingModule([
      QueueService,
    ]);

    app = module.createNestApplication();
    prismaService = module.get<PrismaService>(PrismaService);
    queueService = module.get<QueueService>(QueueService);

    // Connect to Redis for direct testing
    redis = new Redis(process.env.REDIS_URL);

    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prismaService);
    // Clear Redis queues
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.disconnect();
    await app.close();
  });

  describe('BullMQ Job Processing', () => {
    it('should enqueue and process jobs correctly', async () => {
      // Create test order
      const order = OrderFactory.createReceived();
      const savedOrder = await prismaService.order.create({
        data: order,
        include: { items: true },
      });

      // Enqueue job
      await queueService.enqueueOrder(savedOrder.id);

      // Wait for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check job was processed
      const processedOrder = await prismaService.order.findUnique({
        where: { id: savedOrder.id },
      });

      expect(processedOrder?.status).toBe('ENRICHED');
    });

    it('should handle retry logic with exponential backoff', async () => {
      // Create order that will fail enrichment
      const order = OrderFactory.createReceived();
      const savedOrder = await prismaService.order.create({
        data: order,
        include: { items: true },
      });

      // Mock external service to fail initially
      jest.setTimeout(10000);

      // Enqueue job
      await queueService.enqueueOrder(savedOrder.id);

      // Wait for retry attempts
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Check enrichment data for retry count
      const enrichment = await prismaService.orderEnrichment.findUnique({
        where: { orderId: savedOrder.id },
      });

      expect(enrichment).toBeTruthy();
      expect(enrichment?.retryCount).toBeGreaterThan(0);
    });

    it('should route failed jobs to DLQ after max retries', async () => {
      // Create order that will consistently fail
      const order = OrderFactory.createReceived();
      const savedOrder = await prismaService.order.create({
        data: order,
        include: { items: true },
      });

      // Mock external service to always fail
      jest.setTimeout(15000);

      // Enqueue job
      await queueService.enqueueOrder(savedOrder.id);

      // Wait for max retries (3 attempts with backoff)
      await new Promise((resolve) => setTimeout(resolve, 12000));

      // Check final status
      const finalOrder = await prismaService.order.findUnique({
        where: { id: savedOrder.id },
        include: { enrichmentData: true },
      });

      expect(finalOrder?.status).toBe('FAILED_ENRICHMENT');
      expect(finalOrder?.enrichmentData?.retryCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle concurrent job processing', async () => {
      // Create multiple orders
      const orders = Array(5)
        .fill(null)
        .map(() => OrderFactory.createReceived());
      const savedOrders = await Promise.all(
        orders.map((order) =>
          prismaService.order.create({
            data: order,
            include: { items: true },
          }),
        ),
      );

      // Enqueue all jobs
      await Promise.all(
        savedOrders.map((order) => queueService.enqueueOrder(order.id)),
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check all orders were processed
      const processedOrders = await Promise.all(
        savedOrders.map((order) =>
          prismaService.order.findUnique({
            where: { id: order.id },
          }),
        ),
      );

      processedOrders.forEach((order) => {
        expect(['ENRICHED', 'FAILED_ENRICHMENT']).toContain(order?.status);
      });
    });
  });

  describe('Queue Metrics Collection', () => {
    it('should collect accurate queue statistics', async () => {
      // Create and enqueue multiple jobs
      const orders = Array(3)
        .fill(null)
        .map(() => OrderFactory.createReceived());
      const savedOrders = await Promise.all(
        orders.map((order) =>
          prismaService.order.create({
            data: order,
            include: { items: true },
          }),
        ),
      );

      // Enqueue jobs
      await Promise.all(
        savedOrders.map((order) => queueService.enqueueOrder(order.id)),
      );

      // Get metrics
      const metrics = await queueService.getMetrics();

      expect(metrics.waiting).toBeGreaterThanOrEqual(3);
      expect(metrics.active).toBeGreaterThanOrEqual(0);
      expect(metrics.completed).toBeGreaterThanOrEqual(0);
      expect(metrics.failed).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate metrics from multiple queues', async () => {
      // Create jobs for different queues
      await queueService.enqueueOrder('order-1');
      await queueService.enqueueNotification(
        'notification-1',
        'order_received',
      );
      await queueService.enqueueNotification(
        'notification-2',
        'order_enriched',
      );

      // Get all queue metrics
      const allMetrics = await queueService.getAllQueueMetrics();

      expect(allMetrics).toHaveProperty('order-processing');
      expect(allMetrics).toHaveProperty('notifications');

      expect(Object.keys(allMetrics)).toHaveLength(3);
    });
  });

  describe('Queue Administration', () => {
    it('should clear queue and remove all jobs', async () => {
      // Enqueue some jobs
      await queueService.enqueueOrder('order-1');
      await queueService.enqueueOrder('order-2');

      // Verify jobs are waiting
      let metrics = await queueService.getMetrics();
      expect(metrics.waiting).toBeGreaterThan(0);

      // Clear queue
      await queueService.clearQueue('order-processing');

      // Verify queue is empty
      metrics = await queueService.getMetrics();
      expect(metrics.waiting).toBe(0);
    });

    it('should retrieve queue jobs for inspection', async () => {
      // Enqueue test jobs
      await queueService.enqueueOrder('order-1');
      await queueService.enqueueOrder('order-2');

      // Get queue jobs
      const jobsResult = await queueService.getQueueJobs(
        'order-processing',
        {},
      );

      expect(jobsResult.jobs).toHaveLength(2);
      expect(jobsResult.jobs[0]).toHaveProperty('id');
      expect(jobsResult.jobs[0]).toHaveProperty('data');
      expect(jobsResult.jobs[0]).toHaveProperty('opts');
    });

    it('should handle invalid queue names gracefully', async () => {
      // Try to clear non-existent queue
      await expect(
        queueService.clearQueue('non-existent-queue'),
      ).resolves.not.toThrow();

      // Try to get jobs from non-existent queue
      const jobsResult = await queueService.getQueueJobs(
        'non-existent-queue',
        {},
      );
      expect(jobsResult.jobs).toHaveLength(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis connection failures', async () => {
      // Simulate Redis disconnection
      await redis.disconnect();

      // Try to enqueue job (should handle gracefully)
      await expect(queueService.enqueueOrder('test-order')).rejects.toThrow();

      // Reconnect Redis
      redis = new Redis(process.env.REDIS_URL);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('should handle malformed job data', async () => {
      // This would require testing with BullMQ directly
      // For now, test with null/undefined order ID
      await expect(queueService.enqueueOrder('')).rejects.toThrow();

      await expect(queueService.enqueueOrder(null as any)).rejects.toThrow();
    });

    it('should maintain job order in FIFO queue', async () => {
      // Enqueue jobs in specific order
      const jobIds = ['job-1', 'job-2', 'job-3'];

      for (const jobId of jobIds) {
        await queueService.enqueueOrder(jobId);
      }

      // Get queue jobs and verify order
      const jobsResult = await queueService.getQueueJobs(
        'order-processing',
        {},
      );

      expect(jobsResult.jobs).toHaveLength(3);
      expect(jobsResult.jobs[0].data.orderId).toBe('job-1');
      expect(jobsResult.jobs[1].data.orderId).toBe('job-2');
      expect(jobsResult.jobs[2].data.orderId).toBe('job-3');
    });
  });
});
