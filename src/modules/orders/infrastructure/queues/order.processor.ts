import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EnrichmentService } from '../../application/enrichment.service';
import { Job, Queue } from 'bullmq';
import { EnqueueOrderPayload } from '../../domain/types/queue.type';
import { MetricsService } from '../../../../observability/metrics.service';

@Processor('orders')
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);
  constructor(
    private readonly enrichmentService: EnrichmentService,
    @InjectQueue('orders-dlq') private readonly dlqQueue: Queue,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async process(job: Job<EnqueueOrderPayload>): Promise<void> {
    this.logger.log(
      `Processing order ${job.data.order_id}, attempt ${job.attemptsMade + 1}`,
    );
    await this.enrichmentService.enrich(job.data.order_id);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EnqueueOrderPayload>, error: Error) {
    this.metricsService.incrementQueueJob({
      queue: 'orders',
      outcome: 'failed',
    });

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isLastAttempt) {
      this.logger.error(
        `Order ${job.data.order_id} exhausted all retries. Moving to DLQ. Error: ${error.message}`,
      );
      await this.enrichmentService.markAsFailed(job.data.order_id);
      await this.dlqQueue.add('dead-order', {
        ...job.data,
        reason: error.message,
        failedAt: new Date().toISOString(),
      });
      this.metricsService.incrementQueueJob({
        queue: 'orders-dlq',
        outcome: 'dlq',
      });
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EnqueueOrderPayload>) {
    this.metricsService.incrementQueueJob({
      queue: 'orders',
      outcome: 'completed',
    });
    this.logger.log(`Order ${job.data.order_id} processed successfully`);
  }
}
