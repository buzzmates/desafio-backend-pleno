import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Job, Queue } from 'bullmq';
import { EnrichmentService } from '../../application/enrichment.service';
import { EnqueueOrderPayload } from '../../domain/types/queue.type';
import { OrderProcessor } from './order.processor';
import { MetricsService } from '../../../../observability/metrics.service';

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let enrichmentService: jest.Mocked<
    Pick<EnrichmentService, 'enrich' | 'markAsFailed'>
  >;
  let dlqQueue: jest.Mocked<Pick<Queue, 'add'>>;
  let metricsService: jest.Mocked<Pick<MetricsService, 'incrementQueueJob'>>;

  const makeJob = (
    overrides: Partial<Job<EnqueueOrderPayload>> = {},
  ): Job<EnqueueOrderPayload> =>
    ({
      data: { order_id: 'order-1' },
      attemptsMade: 1,
      opts: { attempts: 5 },
      ...overrides,
    }) as Job<EnqueueOrderPayload>;

  beforeEach(() => {
    enrichmentService = {
      enrich: jest.fn(),
      markAsFailed: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<EnrichmentService, 'enrich' | 'markAsFailed'>
    >;

    dlqQueue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Pick<Queue, 'add'>>;

    metricsService = {
      incrementQueueJob: jest.fn(),
    } as unknown as jest.Mocked<Pick<MetricsService, 'incrementQueueJob'>>;

    processor = new OrderProcessor(
      enrichmentService as unknown as EnrichmentService,
      dlqQueue as unknown as Queue,
      metricsService as unknown as MetricsService,
    );
  });

  it('processes a job by delegating enrichment to the application service', async () => {
    const job = makeJob({
      data: { order_id: 'order-1' },
      attemptsMade: 0,
    });

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(enrichmentService.enrich).toHaveBeenCalledWith('order-1');
  });

  it('does not move the job to the DLQ before the last attempt', async () => {
    const job = makeJob({
      data: { order_id: 'order-1' },
      attemptsMade: 1,
      opts: { attempts: 5 },
    });

    await expect(
      processor.onFailed(job, new Error('temporary failure')),
    ).resolves.toBeUndefined();

    expect(metricsService.incrementQueueJob).toHaveBeenCalledWith({
      queue: 'orders',
      outcome: 'failed',
    });
    expect(enrichmentService.markAsFailed).not.toHaveBeenCalled();
    expect(dlqQueue.add).not.toHaveBeenCalled();
  });

  it('marks the order as failed and moves it to the DLQ on the last attempt', async () => {
    const job = makeJob({
      data: { order_id: 'order-1' },
      attemptsMade: 5,
      opts: { attempts: 5 },
    });

    await expect(
      processor.onFailed(job, new Error('exchange API down')),
    ).resolves.toBeUndefined();

    expect(metricsService.incrementQueueJob).toHaveBeenNthCalledWith(1, {
      queue: 'orders',
      outcome: 'failed',
    });
    expect(enrichmentService.markAsFailed).toHaveBeenCalledWith('order-1');
    expect(dlqQueue.add).toHaveBeenCalledWith(
      'dead-order',
      expect.objectContaining({
        order_id: 'order-1',
        reason: 'exchange API down',
        failedAt: expect.any(String),
      }),
    );
    expect(metricsService.incrementQueueJob).toHaveBeenNthCalledWith(2, {
      queue: 'orders-dlq',
      outcome: 'dlq',
    });
  });

  it('increments the completed metric when the job finishes successfully', () => {
    const job = makeJob({
      data: { order_id: 'order-1' },
    });

    processor.onCompleted(job);

    expect(metricsService.incrementQueueJob).toHaveBeenCalledWith({
      queue: 'orders',
      outcome: 'completed',
    });
  });
});
